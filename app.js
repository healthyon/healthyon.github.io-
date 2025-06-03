// 생산계획 관리 시스템 JavaScript
class ProductionPlannerApp {
    constructor() {
        // Supabase 설정
        this.supabaseUrl = 'https://kyspwjebzbozuzhgngxm.supabase.co';
        this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5c3B3amViemJvenV6aGduZ3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3MTk0MTUsImV4cCI6MjA2NDI5NTQxNX0.10iosLA08Q__Y7E6aJgtOWt5_AEYS783kHxSSXsf9Po';
        this.supabase = window.supabase.createClient(this.supabaseUrl, this.supabaseKey);

        // 데이터 저장소
        this.productionPlans = [];
        this.currentDate = new Date();
        this.viewMode = 'month'; // 'month' 또는 'week'
        this.deleteTarget = null;
        this.editingRow = null;

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
            this.addProductionPlan();
        });

        // 수주량 포맷팅
        document.getElementById('orderQuantity').addEventListener('input', (e) => {
            this.formatQuantity(e.target);
        });

        // 달력 뷰 전환
        document.getElementById('monthViewBtn').addEventListener('click', () => {
            this.switchView('month');
        });

        document.getElementById('weekViewBtn').addEventListener('click', () => {
            this.switchView('week');
        });

        // 달력 네비게이션
        document.getElementById('prevPeriod').addEventListener('click', () => {
            this.navigatePeriod(-1);
        });

        document.getElementById('nextPeriod').addEventListener('click', () => {
            this.navigatePeriod(1);
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
            if (document.getElementById('deleteModal').style.display === 'flex') {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.confirmDelete();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.cancelDelete();
                }
            }

            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveToLocalStorage();
                this.showToast('데이터가 저장되었습니다', 'success');
            }
        });
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

    // 인라인 편집 기능
    startEdit(planId) {
        if (this.editingRow) {
            this.showToast('이미 편집 중인 항목이 있습니다', 'warning');
            return;
        }

        const row = document.querySelector(`tr[data-plan-id="${planId}"]`);
        if (!row) return;

        const plan = this.productionPlans.find(p => p.id === planId);
        if (!plan) return;

        this.editingRow = planId;
        this.makeRowEditable(row, plan);
    }

    makeRowEditable(row, plan) {
        const cells = row.querySelectorAll('td');
        const actionsCell = cells[cells.length - 1];

        // 편집 가능한 셀들 설정
        const editableData = [
            { value: plan.customer, type: 'text' },
            { value: plan.product_id, type: 'text' },
            { value: plan.product_name, type: 'text' },
            { value: plan.quantity.toLocaleString('ko-KR'), type: 'number' },
            { value: plan.process_line, type: 'select' },
            { value: plan.start_date, type: 'date' },
            { value: plan.end_date, type: 'date' }
        ];

        editableData.forEach((data, index) => {
            const cell = cells[index];
            const originalValue = cell.textContent;
            
            if (data.type === 'select') {
                const select = document.createElement('select');
                select.className = 'form-control edit-input';
                select.innerHTML = `
                    <option value="PTP1" ${data.value === 'PTP1' ? 'selected' : ''}>PTP1</option>
                    <option value="PTP2" ${data.value === 'PTP2' ? 'selected' : ''}>PTP2</option>
                    <option value="분말스틱1" ${data.value === '분말스틱1' ? 'selected' : ''}>분말스틱1</option>
                    <option value="분말스틱2" ${data.value === '분말스틱2' ? 'selected' : ''}>분말스틱2</option>
                    <option value="분말스틱3" ${data.value === '분말스틱3' ? 'selected' : ''}>분말스틱3</option>
                `;
                cell.innerHTML = '';
                cell.appendChild(select);
            } else {
                const input = document.createElement('input');
                input.type = data.type;
                input.className = 'form-control edit-input';
                input.value = data.type === 'number' ? data.value.replace(/,/g, '') : data.value;
                
                if (data.type === 'number') {
                    input.addEventListener('input', (e) => this.formatQuantity(e.target));
                }
                
                cell.innerHTML = '';
                cell.appendChild(input);
            }
        });

        // 액션 버튼 변경
        actionsCell.innerHTML = `
            <button class="btn btn--small btn--primary" onclick="app.saveEdit(${plan.id})">저장</button>
            <button class="btn btn--small btn--secondary" onclick="app.cancelEdit(${plan.id})">취소</button>
        `;

        row.classList.add('editing');
    }

    async saveEdit(planId) {
        const row = document.querySelector(`tr[data-plan-id="${planId}"]`);
        if (!row) return;

        const inputs = row.querySelectorAll('.edit-input');
        const newData = {
            customer: inputs[0].value,
            product_id: inputs[1].value,
            product_name: inputs[2].value,
            quantity: parseInt(inputs[3].value.replace(/,/g, '')),
            process_line: inputs[4].value,
            start_date: inputs[5].value,
            end_date: inputs[6].value
        };

        // 유효성 검사
        if (!newData.customer || !newData.product_id || !newData.product_name || 
            !newData.quantity || !newData.process_line || !newData.start_date || !newData.end_date) {
            this.showToast('모든 필드를 입력해주세요', 'error');
            return;
        }

        if (new Date(newData.end_date) < new Date(newData.start_date)) {
            this.showToast('완료일은 시작일보다 늦어야 합니다', 'error');
            return;
        }

        try {
            this.updateSaveStatus('saving');

            const { error } = await this.supabase
                .from('production_plans')
                .update(newData)
                .eq('id', planId);

            if (error) throw error;

            this.updateSaveStatus('saved');
            this.showToast('생산계획이 성공적으로 수정되었습니다', 'success');

            await this.loadProductionPlans();
            this.updateCalendar();
            this.updateProductionTable();
            this.editingRow = null;
        } catch (error) {
            console.error('수정 오류:', error);
            this.updateSaveStatus('error');
            this.showToast('수정에 실패했습니다', 'error');

            // 로컬에서 수정
            const planIndex = this.productionPlans.findIndex(p => p.id === planId);
            if (planIndex !== -1) {
                this.productionPlans[planIndex] = { ...this.productionPlans[planIndex], ...newData };
                this.saveToLocalStorage();
                this.updateCalendar();
                this.updateProductionTable();
                this.editingRow = null;
            }
        }
    }

    cancelEdit(planId) {
        this.editingRow = null;
        this.updateProductionTable();
    }

    // 달력 뷰 전환
    switchView(mode) {
        this.viewMode = mode;
        
        const monthBtn = document.getElementById('monthViewBtn');
        const weekBtn = document.getElementById('weekViewBtn');
        
        if (mode === 'month') {
            monthBtn.classList.add('btn--primary');
            monthBtn.classList.remove('btn--secondary');
            weekBtn.classList.add('btn--secondary');
            weekBtn.classList.remove('btn--primary');
        } else {
            weekBtn.classList.add('btn--primary');
            weekBtn.classList.remove('btn--secondary');
            monthBtn.classList.add('btn--secondary');
            monthBtn.classList.remove('btn--primary');
        }
        
        this.updateCalendar();
    }

    navigatePeriod(direction) {
        if (this.viewMode === 'month') {
            this.currentDate.setMonth(this.currentDate.getMonth() + direction);
        } else {
            this.currentDate.setDate(this.currentDate.getDate() + (direction * 7));
        }
        this.updateCalendar();
    }

    updateCalendar() {
        if (this.viewMode === 'month') {
            this.updateMonthCalendar();
        } else {
            this.updateWeekCalendar();
        }
    }

    updateMonthCalendar() {
        const calendar = document.getElementById('productionCalendar');
        const periodDisplay = document.getElementById('currentPeriodDisplay');

        periodDisplay.textContent = `${this.currentDate.getFullYear()}년 ${this.currentDate.getMonth() + 1}월`;

        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        let calendarHTML = '<div class="calendar-grid">';
        
        // 요일 헤더
        const dayHeaders = ['일', '월', '화', '수', '목', '금', '토'];
        dayHeaders.forEach(day => {
            calendarHTML += `<div class="calendar-day-header">${day}</div>`;
        });

        // 달력 날짜들
        for (let i = 0; i < 42; i++) {
            const currentDay = new Date(startDate);
            currentDay.setDate(startDate.getDate() + i);
            
            const isCurrentMonth = currentDay.getMonth() === this.currentDate.getMonth();
            const isToday = this.isToday(currentDay);
            const plansForDay = this.getPlansForDate(currentDay);

            let dayClass = 'calendar-day';
            if (!isCurrentMonth) dayClass += ' calendar-day--other-month';
            if (isToday) dayClass += ' calendar-day--today';

            calendarHTML += `<div class="${dayClass}">`;
            calendarHTML += `<div class="calendar-day-number">${currentDay.getDate()}</div>`;
            
            plansForDay.forEach(plan => {
                const color = this.colorMap[plan.process_line] || '#6B7280';
                calendarHTML += `
                    <div class="calendar-plan-item" style="background-color: ${color}20; border-color: ${color};">
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

    updateWeekCalendar() {
        const calendar = document.getElementById('productionCalendar');
        const periodDisplay = document.getElementById('currentPeriodDisplay');

        // 주의 시작일 (일요일)을 찾기
        const startOfWeek = new Date(this.currentDate);
        startOfWeek.setDate(this.currentDate.getDate() - this.currentDate.getDay());
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        periodDisplay.textContent = `${startOfWeek.getFullYear()}년 ${startOfWeek.getMonth() + 1}월 ${startOfWeek.getDate()}일 - ${endOfWeek.getFullYear()}년 ${endOfWeek.getMonth() + 1}월 ${endOfWeek.getDate()}일`;

        let calendarHTML = '<div class="calendar-grid week-view">';
        
        // 요일 헤더
        const dayHeaders = ['일', '월', '화', '수', '목', '금', '토'];
        dayHeaders.forEach(day => {
            calendarHTML += `<div class="calendar-day-header">${day}</div>`;
        });

        // 주간 날짜들
        for (let i = 0; i < 7; i++) {
            const currentDay = new Date(startOfWeek);
            currentDay.setDate(startOfWeek.getDate() + i);
            
            const isToday = this.isToday(currentDay);
            const plansForDay = this.getPlansForDate(currentDay);

            let dayClass = 'calendar-day week-day';
            if (isToday) dayClass += ' calendar-day--today';

            calendarHTML += `<div class="${dayClass}">`;
            calendarHTML += `<div class="calendar-day-number">${currentDay.getDate()}</div>`;
            
            plansForDay.forEach(plan => {
                const color = this.colorMap[plan.process_line] || '#6B7280';
                calendarHTML += `
                    <div class="calendar-plan-item" style="background-color: ${color}20; border-color: ${color};">
                        <div class="plan-item-text">${plan.customer}</div>
                        <div class="plan-item-line">${plan.process_line}</div>
                        <div class="plan-item-product">${plan.product_name}</div>
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
            tableBody.innerHTML = '<tr><td colspan="8" class="text-center">등록된 생산계획이 없습니다.</td></tr>';
            return;
        }

        let tableHTML = '';
        this.productionPlans.forEach(plan => {
            const color = this.colorMap[plan.process_line] || '#6B7280';
            const isEditing = this.editingRow === plan.id;
            
            tableHTML += `
                <tr data-plan-id="${plan.id}" ${isEditing ? 'class="editing"' : ''}>
                    <td>${plan.customer}</td>
                    <td>${plan.product_id}</td>
                    <td>${plan.product_name}</td>
                    <td>${plan.quantity.toLocaleString('ko-KR')}</td>
                    <td>
                        <span class="process-line-badge" style="background-color: ${color}20; color: ${color}; border: 1px solid ${color};">
                            ${plan.process_line}
                        </span>
                    </td>
                    <td>${plan.start_date}</td>
                    <td>${plan.end_date}</td>
                    <td>
                        <button class="btn btn--small btn--secondary" onclick="app.startEdit(${plan.id})">수정</button>
                        <button class="btn btn--small btn--danger" onclick="app.deletePlan(${plan.id})">삭제</button>
                    </td>
                </tr>
            `;
        });
        
        tableBody.innerHTML = tableHTML;
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

    // 유틸리티 함수들
    updateConnectionStatus(elementId, status) {
        const element = document.getElementById(elementId);
        if (!element) return;

        element.className = `status-dot status-dot--${status}`;
    }

    updateSaveStatus(status) {
        this.updateConnectionStatus('saveStatus', status);
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem('productionPlans', JSON.stringify(this.productionPlans));
        } catch (error) {
            console.error('로컬 저장 오류:', error);
        }
    }

    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('productionPlans');
            if (saved) {
                this.productionPlans = JSON.parse(saved);
            }
        } catch (error) {
            console.error('로컬 로드 오류:', error);
            this.productionPlans = [];
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer') || this.createToastContainer();
        
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // 애니메이션 트리거
        setTimeout(() => toast.classList.add('toast--show'), 100);
        
        // 자동 제거
        setTimeout(() => {
            toast.classList.remove('toast--show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    }
}

// 앱 시작
const app = new ProductionPlannerApp();
