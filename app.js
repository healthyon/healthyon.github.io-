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
        this.editTarget = null; // 편집할 계획 ID
        this.currentView = 'month'; // 'month' 또는 'week'
        this.currentWeekStart = null;

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
        // 오늘 날짜를 기본값으로 설정
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
        // 폼 제출 (추가)
        document.getElementById('productionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addProductionPlan();
        });

        // 편집 모달 저장/취소 버튼 이벤트
        document.getElementById('confirmEdit').addEventListener('click', () => {
            this.confirmEdit();
        });
        document.getElementById('cancelEdit').addEventListener('click', () => {
            this.hideEditModal();
        });

        // 수주량 포맷팅
        document.getElementById('orderQuantity').addEventListener('input', (e) => {
            this.formatQuantity(e.target);
        });
        document.getElementById('editOrderQuantity').addEventListener('input', (e) => {
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

            // 편집 모달이 열려있을 때
            if (document.getElementById('editModal').style.display === 'flex') {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.confirmEdit();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.hideEditModal();
                }
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

        // 버튼 스타일 업데이트
        const monthBtn = document.getElementById('monthViewBtn');
        const weekBtn = document.getElementById('weekViewBtn');

        if (viewType === 'month') {
            monthBtn.className = 'btn btn--small btn--primary';
            weekBtn.className = 'btn btn--small btn--secondary';
        } else {
            monthBtn.className = 'btn btn--small btn--secondary';
            weekBtn.className = 'btn btn--small btn--primary';

            // 주별 보기를 위한 현재 주 시작일 설정
            if (!this.currentWeekStart) {
                this.currentWeekStart = this.getWeekStart(new Date());
            }
        }

        this.updateCalendar();
    }

    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 월요일을 주 시작으로
        return new Date(d.setDate(diff));
    }

    async connectToSupabase() {
        try {
            this.updateConnectionStatus('supabaseStatus', 'connecting');

            // 연결 테스트
            const { data, error } = await this.supabase
                .from('production_plans')
                .select('count', { count: 'exact', head: true });

            if (error && error.code === '42P01') {
                // 테이블이 존재하지 않음
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
            // Supabase에서 데이터 로드 시도
            const { data, error } = await this.supabase
                .from('production_plans')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.productionPlans = data || [];
            this.showToast(`${this.productionPlans.length}개의 생산계획을 불러왔습니다`, 'info');
        } catch (error) {
            console.error('데이터 로드 오류:', error);
            // 로컬 스토리지에서 백업 데이터 로드
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

        // 유효성 검사
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

            // Supabase에 저장
            const { data, error } = await this.supabase
                .from('production_plans')
                .insert([planData])
                .select();

            if (error) throw error;

            this.updateSaveStatus('saved');
            this.showToast('생산계획이 성공적으로 등록되었습니다', 'success');

            // 폼 초기화
            document.getElementById('productionForm').reset();
            this.setDefaultDates();

            // 화면 업데이트
            await this.loadProductionPlans();
            this.updateCalendar();
            this.updateProductionTable();
        } catch (error) {
            console.error('저장 오류:', error);
            this.updateSaveStatus('error');
            this.showToast('저장에 실패했습니다. 로컬에 백업됩니다.', 'error');

            // 로컬 스토리지에 백업
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
            // Supabase에서 삭제
            const { error } = await this.supabase
                .from('production_plans')
                .delete()
                .eq('id', this.deleteTarget);

            if (error) throw error;

            this.showToast('생산계획이 삭제되었습니다', 'success');

            // 화면 업데이트
            await this.loadProductionPlans();
            this.updateCalendar();
            this.updateProductionTable();
        } catch (error) {
            console.error('삭제 오류:', error);
            this.showToast('삭제에 실패했습니다', 'error');

            // 로컬에서 삭제
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

    // ---------- 여기서부터 편집(변경) 관련 메서드 추가 ----------
    async editPlan(planId) {
        // planId에 해당하는 데이터를 찾아서 편집 모달에 값 채우기
        const plan = this.productionPlans.find(p => p.id === planId);
        if (!plan) return;

        this.editTarget = planId; 

        // 편집 폼 필드에 기존 값 채우기
        document.getElementById('editCustomer').value = plan.customer;
        document.getElementById('editManufactureNumber').value = plan.product_id;
        document.getElementById('editProductName').value = plan.product_name;
        document.getElementById('editOrderQuantity').value = plan.quantity.toLocaleString('ko-KR');
        document.getElementById('editProcessLine').value = plan.process_line;
        document.getElementById('editStartDate').value = plan.start_date;
        document.getElementById('editEndDate').value = plan.end_date;

        this.showEditModal();
    }

    showEditModal() {
        document.getElementById('editModal').style.display = 'flex';
    }

    hideEditModal() {
        document.getElementById('editModal').style.display = 'none';
        this.editTarget = null;
    }

    async confirmEdit() {
        if (!this.editTarget) return;

        // 편집된 값 가져오기
        const customer = document.getElementById('editCustomer').value;
        const manufactureNumber = document.getElementById('editManufactureNumber').value;
        const productName = document.getElementById('editProductName').value;
        const orderQuantityRaw = document.getElementById('editOrderQuantity').value.replace(/,/g, '');
        const processLine = document.getElementById('editProcessLine').value;
        const startDate = document.getElementById('editStartDate').value;
        const endDate = document.getElementById('editEndDate').value;

        // 유효성 검사
        if (!customer || !manufactureNumber || !productName || !orderQuantityRaw || !processLine || !startDate || !endDate) {
            this.showToast('모든 필드를 입력해주세요', 'error');
            return;
        }

        if (new Date(endDate) < new Date(startDate)) {
            this.showToast('완료일은 시작일보다 늦어야 합니다', 'error');
            return;
        }

        const updatedData = {
            customer,
            product_id: manufactureNumber,
            product_name: productName,
            quantity: parseInt(orderQuantityRaw),
            process_line: processLine,
            start_date: startDate,
            end_date: endDate
        };

        try {
            this.updateSaveStatus('saving');

            // Supabase에 업데이트
            const { error } = await this.supabase
                .from('production_plans')
                .update(updatedData)
                .eq('id', this.editTarget);

            if (error) throw error;

            this.updateSaveStatus('saved');
            this.showToast('생산계획이 성공적으로 변경되었습니다', 'success');

            // 편집 모달 닫기
            this.hideEditModal();

            // 화면 업데이트
            await this.loadProductionPlans();
            this.updateCalendar();
            this.updateProductionTable();
        } catch (error) {
            console.error('편집 오류:', error);
            this.updateSaveStatus('error');
            this.showToast('변경에 실패했습니다', 'error');
        }
    }
    // ---------- 여기까지 편집(변경) 관련 메서드 ----------

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
        // 월 표시 업데이트
        monthDisplay.textContent = `${this.currentMonth.getFullYear()}년 ${this.currentMonth.getMonth() + 1}월`;

        // 달력 생성
        const firstDay = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
        const lastDay = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        let calendarHTML = '<div class="calendar-grid">';

        // 요일 헤더
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        dayNames.forEach(day => {
            calendarHTML += `<div class="calendar-day-header">${day}</div>`;
        });

        // 날짜 생성
        const currentDate = new Date(startDate);
        const today = new Date();

        for (let week = 0; week < 6; week++) {
            for (let day = 0; day < 7; day++) {
                const isCurrentMonth = currentDate.getMonth() === this.currentMonth.getMonth();
                const isToday = currentDate.toDateString() === today.toDateString();

                let cellClass = 'calendar-day';
                if (!isCurrentMonth) cellClass += ' calendar-day--other-month';
                if (isToday) cellClass += ' calendar-day--today';

                const plansForDay = this.getPlansForDate(currentDate);

                calendarHTML += `
                    <div class="${cellClass}">
                        <div class="calendar-day-number">${currentDate.getDate()}</div>
                        ${this.renderPlansForDay(plansForDay)}
                    </div>
                `;

                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        calendarHTML += '</div>';
        calendar.innerHTML = calendarHTML;
    }

    updateWeekCalendar(calendar, monthDisplay) {
        if (!this.currentWeekStart) {
            this.currentWeekStart = this.getWeekStart(new Date());
        }

        // 주 표시 업데이트
        const weekEnd = new Date(this.currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        monthDisplay.textContent = `${this.currentWeekStart.getFullYear()}년 ${this.currentWeekStart.getMonth() + 1}월 ${this.currentWeekStart.getDate()}일 - ${weekEnd.getMonth() + 1}월 ${weekEnd.getDate()}일`;

        let calendarHTML = '<div class="calendar-grid calendar-grid--week">';

        // 요일 헤더
        const dayNames = ['월', '화', '수', '목', '금', '토', '일'];
        dayNames.forEach(day => {
            calendarHTML += `<div class="calendar-day-header">${day}</div>`;
        });

        // 주의 7일 생성
        const currentDate = new Date(this.currentWeekStart);
        const today = new Date();

        for (let day = 0; day < 7; day++) {
            const isToday = currentDate.toDateString() === today.toDateString();

            let cellClass = 'calendar-day calendar-day--week';
            if (isToday) cellClass += ' calendar-day--today';

            const plansForDay = this.getPlansForDate(currentDate);

            calendarHTML += `
                <div class="${cellClass}">
                    <div class="calendar-day-number">${currentDate.getDate()}</div>
                    ${this.renderPlansForDay(plansForDay)}
                </div>
            `;

            currentDate.setDate(currentDate.getDate() + 1);
        }

        calendarHTML += '</div>';
        calendar.innerHTML = calendarHTML;
    }

    getPlansForDate(date) {
        const dateStr = date.toISOString().split('T')[0];
        return this.productionPlans.filter(plan => {
            return dateStr >= plan.start_date && dateStr <= plan.end_date;
        });
    }

    renderPlansForDay(plans) {
        return plans.map(plan => {
            const color = this.colorMap[plan.process_line] || '#666';
            return `
                <div class="calendar-plan-item" style="border-color: ${color}; background-color: ${color}20" onclick="app.showPlanDetails(${plan.id})">
                    <div class="plan-item-text">${plan.product_name}</div>
                    <div class="plan-item-line">${plan.process_line}</div>
                </div>
            `;
        }).join('');
    }

    showPlanDetails(planId) {
        const plan = this.productionPlans.find(p => p.id === planId);
        if (plan) {
            const details = `
고객사: ${plan.customer}
제조번호: ${plan.product_id}
제품명: ${plan.product_name}
수주량: ${plan.quantity.toLocaleString('ko-KR')} EA
공정라인: ${plan.process_line}
시작일: ${plan.start_date}
완료일: ${plan.end_date}
            `;
            alert(details);
        }
    }

    updateProductionTable() {
        const tbody = document.getElementById('productionTableBody');

        tbody.innerHTML = this.productionPlans.map(plan => {
            const color = this.colorMap[plan.process_line] || '#666';
            return `
                <tr>
                    <td>${plan.customer}</td>
                    <td>${plan.product_id}</td>
                    <td>${plan.product_name}</td>
                    <td>${plan.quantity.toLocaleString('ko-KR')} EA</td>
                    <td>
                        <span class="process-line-badge" style="background-color: ${color}; color: white;">
                            ${plan.process_line}
                        </span>
                    </td>
                    <td>${plan.start_date}</td>
                    <td>${plan.end_date}</td>
                    <td class="text-center">
                        <button class="btn btn--small btn--secondary" onclick="app.editPlan(${plan.id})">
                            ✏️ 변경
                        </button>
                        <button class="btn btn--small btn--danger" onclick="app.deletePlan(${plan.id})">
                            🗑️ 삭제
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    saveToLocalStorage() {
        localStorage.setItem('productionPlans', JSON.stringify(this.productionPlans));
    }

    loadFromLocalStorage() {
        const saved = localStorage.getItem('productionPlans');
        if (saved) {
            this.productionPlans = JSON.parse(saved);
        }
    }

    updateConnectionStatus(elementId, status) {
        const element = document.getElementById(elementId);
        if (element) {
            element.className = `status-dot status-dot--${status}`;
        }
    }

    updateSaveStatus(status) {
        this.updateConnectionStatus('saveStatus', status);

        setTimeout(() => {
            if (status === 'saving') {
                this.updateConnectionStatus('saveStatus', 'saved');
            }
        }, 1500);
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        // 애니메이션 시작
        setTimeout(() => {
            toast.classList.add('toast--show');
        }, 100);

        // 자동 제거
        setTimeout(() => {
            toast.classList.remove('toast--show');
            setTimeout(() => {
                if (container.contains(toast)) {
                    container.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

// 앱 초기화
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new ProductionPlannerApp();
});
