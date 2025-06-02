// 생산계획 관리 시스템 JavaScript
class ProductionPlannerApp {
    constructor() {
        // Supabase 설정
        this.supabaseUrl = 'https://kyspwjebzbozuzhgngxm.supabase.co';
        this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5c3B3amViemJvenV6aGduZ3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3MTk0MTUsImV4cCI6MjA2NDI5NTQxNX0.10iosLA08Q__Y7E6aJgtOWt5_AEYS783kHxSSXsf9Po';
        this.supabase = window.supabase.createClient(this.supabaseUrl, this.supabaseKey);

        // 데이터 저장소
        this.productionPlans = [];
        this.currentMonth = new Date();
        this.deleteTarget = null;
        this.currentView = 'month';
        this.currentWeekStart = null;
        
        // 수정 기능을 위한 변수 추가
        this.editingPlan = null;
        this.isEditMode = false;

        // 공정라인 색상 매핑
        this.colorMap = {
            'PTP1': '#8B5CF6',
            'PTP2': '#10B981',
            '분말스틱1': '#F59E0B',
            '분말스틱2': '#EC4899',
            '분말스틱3': '#8B5A2B'
        };

        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.setDefaultDates();
        await this.connectToSupabase();
        await this.loadProductionPlans();
        this.updateCalendar();
        this.updateProductionTable();
        this.setupRealtimeSubscription();
    }

    setDefaultDates() {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');

        if (startDateInput) {
            startDateInput.value = today.toISOString().split('T')[0];
        }
        if (endDateInput) {
            endDateInput.value = tomorrow.toISOString().split('T')[0];
        }
    }

    setupEventListeners() {
        // 폼 제출
        document.getElementById('productionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.isEditMode) {
                this.updateProductionPlan();
            } else {
                this.addProductionPlan();
            }
        });

        // 수주량 포맷팅
        document.getElementById('orderQuantity').addEventListener('input', (e) => {
            this.formatQuantity(e.target);
        });

        // 달력 네비게이션
        document.getElementById('prevMonth').addEventListener('click', () => {
            if (this.currentView === 'month') {
                this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
            } else {
                this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 7);
            }
            this.updateCalendar();
        });

        document.getElementById('nextMonth').addEventListener('click', () => {
            if (this.currentView === 'month') {
                this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
            } else {
                this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
            }
            this.updateCalendar();
        });

        // 뷰 전환 버튼
        document.getElementById('monthViewBtn').addEventListener('click', () => {
            this.switchView('month');
        });

        document.getElementById('weekViewBtn').addEventListener('click', () => {
            this.switchView('week');
        });

        // 수동 저장 버튼
        document.getElementById('saveButton').addEventListener('click', () => {
            this.saveToLocalStorage();
            this.showToast('데이터가 로컬에 저장되었습니다', 'success');
        });

        // 삭제 모달 이벤트
        document.getElementById('confirmDelete').addEventListener('click', () => {
            this.confirmDelete();
        });

        document.getElementById('cancelDelete').addEventListener('click', () => {
            this.cancelDelete();
        });

        // 수정 취소 버튼 이벤트 추가
        document.getElementById('cancelEdit').addEventListener('click', () => {
            this.cancelEdit();
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // 삭제 모달이 열려있을 때
            if (document.getElementById('deleteModal').style.display === 'flex') {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.confirmDelete();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.cancelDelete();
                }
            }

            // 수정 모드일 때 ESC로 취소
            if (this.isEditMode && e.key === 'Escape') {
                e.preventDefault();
                this.cancelEdit();
            }

            // 전역 단축키
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveToLocalStorage();
                this.showToast('데이터가 저장되었습니다', 'success');
            }
        });
    }

    switchView(viewType) {
        this.currentView = viewType;

        const monthBtn = document.getElementById('monthViewBtn');
        const weekBtn = document.getElementById('weekViewBtn');

        if (viewType === 'month') {
            monthBtn.className = 'btn btn--small btn--primary';
            weekBtn.className = 'btn btn--small btn--secondary';
        } else {
            monthBtn.className = 'btn btn--small btn--secondary';
            weekBtn.className = 'btn btn--small btn--primary';

            if (!this.currentWeekStart) {
                this.currentWeekStart = this.getWeekStart(new Date());
            }
        }

        this.updateCalendar();
    }

    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }

    async connectToSupabase() {
        try {
            this.updateConnectionStatus('supabaseStatus', 'connecting');

            const { data, error } = await this.supabase
                .from('production_plans')
                .select('count', { count: 'exact', head: true });

            if (error && error.code === '42P01') {
                this.showToast('Supabase 테이블을 생성해야 합니다', 'warning');
                this.updateConnectionStatus('supabaseStatus', 'error');
                return false;
            } else if (error) {
                throw error;
            }

            this.updateConnectionStatus('supabaseStatus', 'connected');
            this.showToast('Supabase에 성공적으로 연결되었습니다', 'success');
            return true;
        } catch (error) {
            console.error('Supabase 연결 오류:', error);
            this.updateConnectionStatus('supabaseStatus', 'error');
            this.showToast('Supabase 연결에 실패했습니다. 오프라인 모드로 전환합니다.', 'error');
            return false;
        }
    }

    async loadProductionPlans() {
        try {
            const { data, error } = await this.supabase
                .from('production_plans')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.productionPlans = data || [];
            this.showToast(`${this.productionPlans.length}개의 생산계획을 불러왔습니다`, 'info');
        } catch (error) {
            console.error('데이터 로드 오류:', error);
            this.loadFromLocalStorage();
            this.showToast('로컬 백업 데이터를 사용합니다', 'warning');
        }
    }

    setupRealtimeSubscription() {
        try {
            this.supabase
                .channel('production_plans')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'production_plans'
                }, (payload) => {
                    console.log('실시간 변경:', payload);
                    this.loadProductionPlans().then(() => {
                        this.updateCalendar();
                        this.updateProductionTable();
                        this.showToast('데이터가 실시간으로 동기화되었습니다', 'info');
                    });
                })
                .subscribe();
        } catch (error) {
            console.error('실시간 구독 오류:', error);
        }
    }

    formatQuantity(input) {
        let value = input.value.replace(/,/g, '');
        if (!isNaN(value) && value !== '') {
            input.value = parseInt(value).toLocaleString('ko-KR');
        }
    }

    async addProductionPlan() {
        const customer = document.getElementById('customer').value;
        const manufactureNumber = document.getElementById('manufactureNumber').value;
        const productName = document.getElementById('productName').value;
        const orderQuantity = document.getElementById('orderQuantity').value.replace(/,/g, '');
        const processLine = document.getElementById('processLine').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        if (!customer || !manufactureNumber || !productName || !orderQuantity || !processLine || !startDate || !endDate) {
            this.showToast('모든 필드를 입력해주세요', 'error');
            return;
        }

        if (new Date(endDate) < new Date(startDate)) {
            this.showToast('완료일은 시작일보다 늦어야 합니다', 'error');
            return;
        }

        const planData = {
            customer,
            product_id: manufactureNumber,
            product_name: productName,
            quantity: parseInt(orderQuantity),
            process_line: processLine,
            start_date: startDate,
            end_date: endDate
        };

        try {
            this.updateSaveStatus('saving');

            const { data, error } = await this.supabase
                .from('production_plans')
                .insert([planData])
                .select();

            if (error) throw error;

            this.updateSaveStatus('saved');
            this.showToast('생산계획이 성공적으로 등록되었습니다', 'success');

            document.getElementById('productionForm').reset();
            this.setDefaultDates();

            await this.loadProductionPlans();
            this.updateCalendar();
            this.updateProductionTable();
        } catch (error) {
            console.error('저장 오류:', error);
            this.updateSaveStatus('error');
            this.showToast('저장에 실패했습니다. 로컬에 백업됩니다.', 'error');

            this.productionPlans.unshift({
                id: Date.now(),
                ...planData,
                created_at: new Date().toISOString()
            });
            this.saveToLocalStorage();
            this.updateCalendar();
            this.updateProductionTable();
        }
    }

    // 수정 기능 추가
    editPlan(planId) {
        const plan = this.productionPlans.find(p => p.id === planId);
        if (!plan) return;

        this.isEditMode = true;
        this.editingPlan = plan;

        // 폼에 기존 데이터 채우기
        document.getElementById('customer').value = plan.customer;
        document.getElementById('manufactureNumber').value = plan.product_id;
        document.getElementById('productName').value = plan.product_name;
        document.getElementById('orderQuantity').value = plan.quantity.toLocaleString('ko-KR');
        document.getElementById('processLine').value = plan.process_line;
        document.getElementById('startDate').value = plan.start_date;
        document.getElementById('endDate').value = plan.end_date;

        // 폼 제출 버튼 텍스트 변경
        const submitBtn = document.querySelector('#productionForm button[type="submit"]');
        submitBtn.textContent = '계획 수정';

        // 취소 버튼 표시
        document.getElementById('cancelEdit').style.display = 'inline-flex';

        // 폼으로 스크롤
        document.getElementById('productionForm').scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });

        this.showToast('수정 모드로 전환되었습니다', 'info');
    }

    async updateProductionPlan() {
        const customer = document.getElementById('customer').value;
        const manufactureNumber = document.getElementById('manufactureNumber').value;
        const productName = document.getElementById('productName').value;
        const orderQuantity = document.getElementById('orderQuantity').value.replace(/,/g, '');
        const processLine = document.getElementById('processLine').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        if (!customer || !manufactureNumber || !productName || !orderQuantity || !processLine || !startDate || !endDate) {
            this.showToast('모든 필드를 입력해주세요', 'error');
            return;
        }

        if (new Date(endDate) < new Date(startDate)) {
            this.showToast('완료일은 시작일보다 늦어야 합니다', 'error');
            return;
        }

        const updateData = {
            customer,
            product_id: manufactureNumber,
            product_name: productName,
            quantity: parseInt(orderQuantity),
            process_line: processLine,
            start_date: startDate,
            end_date: endDate
        };

        try {
            this.updateSaveStatus('saving');

            const { data, error } = await this.supabase
                .from('production_plans')
                .update(updateData)
                .eq('id', this.editingPlan.id)
                .select();

            if (error) throw error;

            this.updateSaveStatus('saved');
            this.showToast('생산계획이 성공적으로 수정되었습니다', 'success');

            this.cancelEdit();

            await this.loadProductionPlans();
            this.updateCalendar();
            this.updateProductionTable();
        } catch (error) {
            console.error('수정 오류:', error);
            this.updateSaveStatus('error');
            this.showToast('수정에 실패했습니다.', 'error');

            // 로컬에서도 수정
            const localPlan = this.productionPlans.find(p => p.id === this.editingPlan.id);
            if (localPlan) {
                Object.assign(localPlan, updateData);
                this.saveToLocalStorage();
                this.updateCalendar();
                this.updateProductionTable();
            }
        }
    }

    cancelEdit() {
        this.isEditMode = false;
        this.editingPlan = null;

        // 폼 초기화
        document.getElementById('productionForm').reset();
        this.setDefaultDates();

        // 버튼 텍스트 원래대로
        const submitBtn = document.querySelector('#productionForm button[type="submit"]');
        submitBtn.textContent = '계획 등록';

        // 취소 버튼 숨기기
        document.getElementById('cancelEdit').style.display = 'none';

        this.showToast('수정이 취소되었습니다', 'info');
    }

    async deletePlan(planId) {
        this.deleteTarget = planId;
        this.showDeleteModal();
    }

    showDeleteModal() {
        document.getElementById('deleteModal').style.display = 'flex';
    }

    hideDeleteModal() {
        document.getElementById('deleteModal').style.display = 'none';
        this.deleteTarget = null;
    }

    async confirmDelete() {
        if (!this.deleteTarget) return;

        try {
            const { error } = await this.supabase
                .from('production_plans')
                .delete()
                .eq('id', this.deleteTarget);

            if (error) throw error;

            this.showToast('생산계획이 삭제되었습니다', 'success');

            await this.loadProductionPlans();
            this.updateCalendar();
            this.updateProductionTable();
        } catch (error) {
            console.error('삭제 오류:', error);
            this.showToast('삭제에 실패했습니다', 'error');

            this.productionPlans = this.productionPlans.filter(plan => plan.id !== this.deleteTarget);
            this.saveToLocalStorage();
            this.updateCalendar();
            this.updateProductionTable();
        }

        this.hideDeleteModal();
    }

    cancelDelete() {
        this.hideDeleteModal();
    }

    updateCalendar() {
        const calendar = document.getElementById('productionCalendar');
        const monthDisplay = document.getElementById('currentMonthDisplay');

        if (this.currentView === 'month') {
            this.updateMonthCalendar(calendar, monthDisplay);
        } else {
            this.updateWeekCalendar(calendar, monthDisplay);
        }
    }

    updateMonthCalendar(calendar, monthDisplay) {
        monthDisplay.textContent = `${this.currentMonth.getFullYear()}년 ${this.currentMonth.getMonth() + 1}월`;

        const firstDay = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
        const lastDay = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        let calendarHTML = '<div class="calendar-grid">';
        
        const dayHeaders = ['일', '월', '화', '수', '목', '금', '토'];
        dayHeaders.forEach(day => {
            calendarHTML += `<div class="calendar-day-header">${day}</div>`;
        });

        for (let i = 0; i < 42; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            
            const isCurrentMonth = currentDate.getMonth() === this.currentMonth.getMonth();
            const isToday = this.isToday(currentDate);
            
            let dayClass = 'calendar-day';
            if (!isCurrentMonth) dayClass += ' calendar-day--other-month';
            if (isToday) dayClass += ' calendar-day--today';

            const plansForDay = this.getPlansForDate(currentDate);
            
            calendarHTML += `<div class="${dayClass}">`;
            calendarHTML += `<div class="calendar-day-number">${currentDate.getDate()}</div>`;
            
            plansForDay.forEach(plan => {
                const color = this.colorMap[plan.process_line] || '#6B7280';
                calendarHTML += `
                    <div class="calendar-plan-item" style="border-color: ${color}; background-color: ${color}20;">
                        <div class="plan-item-text">${plan.customer}</div>
                        <div class="plan-item-line">${plan.process_line}</div>
                    </div>
                `;
            });
            
            calendarHTML += '</div>';
        }
        
        calendarHTML += '</div>';
        calendar.innerHTML = calendarHTML;
    }

    updateWeekCalendar(calendar, monthDisplay) {
        const weekStart = new Date(this.currentWeekStart);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        monthDisplay.textContent = `${weekStart.getFullYear()}년 ${weekStart.getMonth() + 1}월 ${weekStart.getDate()}일 - ${weekEnd.getMonth() + 1}월 ${weekEnd.getDate()}일`;

        let calendarHTML = '<div class="calendar-grid calendar-grid--week">';
        
        const dayHeaders = ['월', '화', '수', '목', '금', '토', '일'];
        dayHeaders.forEach(day => {
            calendarHTML += `<div class="calendar-day-header">${day}</div>`;
        });

        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(weekStart);
            currentDate.setDate(weekStart.getDate() + i);
            
            const isToday = this.isToday(currentDate);
            let dayClass = 'calendar-day calendar-day--week';
            if (isToday) dayClass += ' calendar-day--today';

            const plansForDay = this.getPlansForDate(currentDate);
            
            calendarHTML += `<div class="${dayClass}">`;
            calendarHTML += `<div class="calendar-day-number">${currentDate.getDate()}</div>`;
            
            plansForDay.forEach(plan => {
                const color = this.colorMap[plan.process_line] || '#6B7280';
                calendarHTML += `
                    <div class="calendar-plan-item" style="border-color: ${color}; background-color: ${color}20;">
                        <div class="plan-item-text">${plan.customer}</div>
                        <div class="plan-item-line">${plan.process_line}</div>
                    </div>
                `;
            });
            
            calendarHTML += '</div>';
        }
        
        calendarHTML += '</div>';
        calendar.innerHTML = calendarHTML;
    }

    isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    getPlansForDate(date) {
        const dateStr = date.toISOString().split('T')[0];
        return this.productionPlans.filter(plan => {
            return dateStr >= plan.start_date && dateStr <= plan.end_date;
        });
    }

    updateProductionTable() {
        const tableBody = document.getElementById('productionTableBody');
        
        if (this.productionPlans.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">등록된 생산계획이 없습니다</td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = this.productionPlans.map(plan => {
            const color = this.colorMap[plan.process_line] || '#6B7280';
            return `
                <tr>
                    <td>${plan.customer}</td>
                    <td>${plan.product_id}</td>
                    <td>${plan.product_name}</td>
                    <td>${plan.quantity.toLocaleString('ko-KR')} EA</td>
                    <td>
                        <span class="process-line-badge" style="background-color: ${color}20; color: ${color}; border: 1px solid ${color};">
                            ${plan.process_line}
                        </span>
                    </td>
                    <td>${plan.start_date}</td>
                    <td>${plan.end_date}</td>
                    <td>
                        <button class="btn btn--small btn--secondary" onclick="app.editPlan(${plan.id})" style="margin-right: 4px;">
                            수정
                        </button>
                        <button class="btn btn--small btn--danger" onclick="app.deletePlan(${plan.id})">
                            삭제
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    updateConnectionStatus(elementId, status) {
        const statusElement = document.getElementById(elementId);
        if (statusElement) {
            const dot = statusElement.querySelector('.status-dot');
            dot.className = `status-dot status-dot--${status}`;
        }
    }

    updateSaveStatus(status) {
        this.updateConnectionStatus('saveStatus', status);
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem('productionPlans', JSON.stringify(this.productionPlans));
            return true;
        } catch (error) {
            console.error('로컬 저장 오류:', error);
            return false;
        }
    }

    loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem('productionPlans');
            if (stored) {
                this.productionPlans = JSON.parse(stored);
            }
        } catch (error) {
            console.error('로컬 로드 오류:', error);
            this.productionPlans = [];
        }
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.textContent = message;

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast--show');
        }, 100);

        setTimeout(() => {
            toast.classList.remove('toast--show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

// 앱 초기화
const app = new ProductionPlannerApp();
