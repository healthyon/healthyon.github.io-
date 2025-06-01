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
        // 폼 제출
        document.getElementById('productionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addProductionPlan();
        });
        
        // 수주량 포맷팅
        document.getElementById('orderQuantity').addEventListener('input', (e) => {
            this.formatQuantity(e.target);
        });
        
        // 달력 네비게이션
        document.getElementById('prevMonth').addEventListener('click', () => {
            this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
            this.updateCalendar();
        });
        
        document.getElementById('nextMonth').addEventListener('click', () => {
            this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
            this.updateCalendar();
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
            
            // 전역 단축키
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
                .on('postgres_changes', 
                    { event: '*', schema: 'public', table: 'production_plans' },
                    (payload) => {
                        console.log('실시간 변경:', payload);
                        this.loadProductionPlans().then(() => {
                            this.updateCalendar();
                            this.updateProductionTable();
                            this.showToast('데이터가 실시간으로 동기화되었습니다', 'info');
                        });
                    }
                )
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
    
    updateCalendar() {
        const calendar = document.getElementById('productionCalendar');
        const monthDisplay = document.getElementById('currentMonthDisplay');
        
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
        
        // 날짜 셀
        for (let i = 0; i < 42; i++) {
            const cellDate = new Date(startDate);
            cellDate.setDate(startDate.getDate() + i);
            
            const isCurrentMonth = cellDate.getMonth() === this.currentMonth.getMonth();
            const isToday = this.isToday(cellDate);
            
            const dayPlans = this.getDayPlans(cellDate);
            
            let cellClass = 'calendar-day';
            if (!isCurrentMonth) cellClass += ' calendar-day--other-month';
            if (isToday) cellClass += ' calendar-day--today';
            
            calendarHTML += `<div class="${cellClass}" data-date="${cellDate.toISOString().split('T')[0]}">`;
            calendarHTML += `<div class="calendar-day-number">${cellDate.getDate()}</div>`;
            
            // 해당 날짜의 계획들
            dayPlans.forEach(plan => {
                const color = this.colorMap[plan.process_line] || '#6B7280';
                calendarHTML += `
                    <div class="calendar-plan-item" 
                         style="background-color: ${color}20; border-color: ${color};"
                         data-plan-id="${plan.id}"
                         data-tooltip="${this.createTooltipContent(plan)}">
                        <div class="plan-item-text">${plan.product_name}</div>
                        <div class="plan-item-line">${plan.process_line}</div>
                    </div>
                `;
            });
            
            calendarHTML += '</div>';
        }
        
        calendarHTML += '</div>';
        calendar.innerHTML = calendarHTML;
        
        // 툴팁 이벤트 추가
        this.setupTooltips();
    }
    
    getDayPlans(date) {
        const dateStr = date.toISOString().split('T')[0];
        return this.productionPlans.filter(plan => {
            return dateStr >= plan.start_date && dateStr <= plan.end_date;
        });
    }
    
    isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }
    
    createTooltipContent(plan) {
        return `
            고객사: ${plan.customer}
            제조번호: ${plan.product_id}
            제품명: ${plan.product_name}
            수주량: ${plan.quantity.toLocaleString('ko-KR')} EA
            공정라인: ${plan.process_line}
            기간: ${plan.start_date} ~ ${plan.end_date}
        `.trim();
    }
    
    setupTooltips() {
        const planItems = document.querySelectorAll('.calendar-plan-item');
        const tooltip = document.getElementById('tooltip');
        
        planItems.forEach(item => {
            item.addEventListener('mouseenter', (e) => {
                const content = e.target.getAttribute('data-tooltip');
                tooltip.innerHTML = content.replace(/\n/g, '<br>');
                tooltip.style.display = 'block';
                this.updateTooltipPosition(e, tooltip);
            });
            
            item.addEventListener('mousemove', (e) => {
                this.updateTooltipPosition(e, tooltip);
            });
            
            item.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });
        });
    }
    
    updateTooltipPosition(e, tooltip) {
        const x = e.pageX + 10;
        const y = e.pageY + 10;
        
        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
        
        // 화면 경계 체크
        const rect = tooltip.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            tooltip.style.left = (x - rect.width - 20) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            tooltip.style.top = (y - rect.height - 20) + 'px';
        }
    }
    
    updateProductionTable() {
        const tbody = document.getElementById('productionTableBody');
        
        if (this.productionPlans.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">등록된 생산계획이 없습니다.</td></tr>';
            return;
        }
        
        tbody.innerHTML = this.productionPlans.map(plan => `
            <tr>
                <td>${plan.customer}</td>
                <td>${plan.product_id}</td>
                <td>${plan.product_name}</td>
                <td>${plan.quantity.toLocaleString('ko-KR')} EA</td>
                <td>
                    <span class="process-line-badge" style="background-color: ${this.colorMap[plan.process_line]}20; color: ${this.colorMap[plan.process_line]};">
                        ${plan.process_line}
                    </span>
                </td>
                <td>${plan.start_date}</td>
                <td>${plan.end_date}</td>
                <td>
                    <button class="btn btn--danger btn--small" onclick="app.deletePlan('${plan.id}')">
                        삭제
                    </button>
                </td>
            </tr>
        `).join('');
    }
    
    updateConnectionStatus(elementId, status) {
        const element = document.getElementById(elementId);
        element.className = `status-dot status-dot--${status}`;
    }
    
    updateSaveStatus(status) {
        const statusElement = document.getElementById('saveStatus');
        const textElement = document.getElementById('saveStatusText');
        
        statusElement.className = `status-dot status-dot--${status}`;
        
        switch (status) {
            case 'saving':
                textElement.textContent = '저장중';
                break;
            case 'saved':
                textElement.textContent = '저장완료';
                setTimeout(() => {
                    textElement.textContent = '대기중';
                    statusElement.className = 'status-dot';
                }, 3000);
                break;
            case 'error':
                textElement.textContent = '저장실패';
                break;
            default:
                textElement.textContent = '대기중';
        }
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
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('toast--show');
        }, 100);
        
        setTimeout(() => {
            toast.classList.remove('toast--show');
            setTimeout(() => {
                container.removeChild(toast);
            }, 300);
        }, 3000);
    }
}

// 앱 초기화
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new ProductionPlannerApp();
});
