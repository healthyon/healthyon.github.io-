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
        this.editTarget = null;
        this.currentViewMode = 'month'; // 'month' or 'week'
        this.currentWeekStart = new Date();

        // 공정라인 색상 매핑 (11개 공정) - 채도 조정으로 부드럽게
        this.colorMap = {
            'PTP1': '#C75A5A', // 부드러운 빨간색 (기존 #E31A1C에서 채도 낮춤)
            'PTP2': '#5A9BC7', // 부드러운 파란색 (기존 #1F78B4에서 채도 낮춤)
            '분말스틱1': '#6BB26B', // 부드러운 초록색 (기존 #33A02C에서 채도 낮춤)
            '분말스틱2': '#D18A47', // 부드러운 주황색 (기존 #FF7F00에서 채도 낮춤)
            '분말스틱3': '#8A6BB2', // 부드러운 보라색 (기존 #6A3D9A에서 채도 낮춤)
            '칭량': '#90C4E0', // 연한 파란색 (약간 채도 조정)
            '과립': '#A8D4A8', // 연한 초록색 (약간 채도 조정)
            '혼합': '#F0A8A8', // 연한 빨간색 (약간 채도 조정)
            '타정': '#F0C785', // 연한 주황색 (약간 채도 조정)
            '코팅': '#C9A8D4', // 연한 보라색 (약간 채도 조정)
            '선별': '#E6E680' // 부드러운 노란색 (약간 채도 조정)
        };

        // 공정 순서 정의
        this.processOrder = [
            'PTP1', 'PTP2', '분말스틱1', '분말스틱2', '분말스틱3',
            '칭량', '과립', '혼합', '타정', '코팅', '선별'
        ];

        this.init();
    }

    // 날짜 문자열을 로컬 시간으로 파싱하는 함수 (한국시간 기준)
    parseLocalDate(dateString) {
        const parts = dateString.split('-');
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }

    // 날짜를 YYYY-MM-DD 형식으로 변환하는 함수 (로컬 시간 기준)
    formatLocalDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // 두 날짜가 같은 날인지 확인하는 함수 (로컬 시간 기준)
    isSameDate(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }

    // 날짜가 범위 내에 있는지 확인하는 함수 (로컬 시간 기준)
    isDateInRange(date, startDate, endDate) {
        const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const startOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const endOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        return dateOnly >= startOnly && dateOnly <= endOnly;
    }

    async init() {
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.setDefaultDates();
        this.setCurrentWeek();
        this.setupTooltip();
        await this.connectToSupabase();
        await this.loadProductionPlans();
        this.updateCalendar();
        this.updateProductionTable();
        this.setupRealtimeSubscription();
    }

    setupTooltip() {
        this.tooltip = document.getElementById('tooltip');
        
        // 전역 마우스 이벤트 리스너
        document.addEventListener('mousemove', (e) => {
            if (this.tooltip.style.display === 'block') {
                this.tooltip.style.left = e.pageX + 10 + 'px';
                this.tooltip.style.top = e.pageY + 10 + 'px';
            }
        });
    }

    showTooltip(element, content) {
        this.tooltip.innerHTML = content;
        this.tooltip.style.display = 'block';
        element.addEventListener('mouseleave', () => {
            this.hideTooltip();
        }, { once: true });
    }

    hideTooltip() {
        this.tooltip.style.display = 'none';
    }

    setDefaultDates() {
        // 오늘 날짜를 기본값으로 설정 (로컬 시간 기준)
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');

        if (startDateInput) {
            startDateInput.value = this.formatLocalDate(today);
        }
        if (endDateInput) {
            endDateInput.value = this.formatLocalDate(tomorrow);
        }
    }

    setCurrentWeek() {
        // 현재 주의 시작일(월요일)로 설정
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1); // 월요일 구하기
        this.currentWeekStart = new Date(today.setDate(diff));
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
            if (this.currentViewMode === 'month') {
                this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
            } else {
                this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 7);
            }
            this.updateCalendar();
        });

        document.getElementById('nextMonth').addEventListener('click', () => {
            if (this.currentViewMode === 'month') {
                this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
            } else {
                this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
            }
            this.updateCalendar();
        });

        // 뷰 모드 전환
        document.getElementById('monthViewBtn').addEventListener('click', () => {
            this.switchToMonthView();
        });

        document.getElementById('weekViewBtn').addEventListener('click', () => {
            this.switchToWeekView();
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

        // 편집 모달 이벤트
        document.getElementById('editForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.confirmEdit();
        });

        document.getElementById('cancelEdit').addEventListener('click', () => {
            this.cancelEdit();
        });

        // 편집 폼 수주량 포맷팅
        document.getElementById('editOrderQuantity').addEventListener('input', (e) => {
            this.formatQuantity(e.target);
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
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.cancelEdit();
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

        // 날짜 비교 (로컬 시간 기준)
        const startDateObj = this.parseLocalDate(startDate);
        const endDateObj = this.parseLocalDate(endDate);

        if (endDateObj < startDateObj) {
            this.showToast('완료일은 시작일보다 늦어야 합니다', 'error');
            return;
        }

        const planData = {
            customer,
            product_id: manufactureNumber,
            product_name: productName,
            quantity: parseInt(orderQuantity),
            process_line: processLine,
            start_date: startDate, // 직접 문자열로 저장
            end_date: endDate // 직접 문자열로 저장
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

    async editPlan(planId) {
        const plan = this.productionPlans.find(p => p.id === planId);
        if (!plan) return;

        this.editTarget = planId;

        // 편집 폼에 현재 값 설정
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

        const customer = document.getElementById('editCustomer').value;
        const manufactureNumber = document.getElementById('editManufactureNumber').value;
        const productName = document.getElementById('editProductName').value;
        const orderQuantity = document.getElementById('editOrderQuantity').value.replace(/,/g, '');
        const processLine = document.getElementById('editProcessLine').value;
        const startDate = document.getElementById('editStartDate').value;
        const endDate = document.getElementById('editEndDate').value;

        // 유효성 검사
        if (!customer || !manufactureNumber || !productName || !orderQuantity || !processLine || !startDate || !endDate) {
            this.showToast('모든 필드를 입력해주세요', 'error');
            return;
        }

        // 날짜 비교 (로컬 시간 기준)
        const startDateObj = this.parseLocalDate(startDate);
        const endDateObj = this.parseLocalDate(endDate);

        if (endDateObj < startDateObj) {
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
            end_date: endDate,
            updated_at: new Date().toISOString()
        };

        try {
            // Supabase에서 업데이트
            const { error } = await this.supabase
                .from('production_plans')
                .update(updateData)
                .eq('id', this.editTarget);

            if (error) throw error;

            this.showToast('생산계획이 수정되었습니다', 'success');

            // 화면 업데이트
            await this.loadProductionPlans();
            this.updateCalendar();
            this.updateProductionTable();

        } catch (error) {
            console.error('수정 오류:', error);
            this.showToast('수정에 실패했습니다', 'error');

            // 로컬에서 수정
            const planIndex = this.productionPlans.findIndex(plan => plan.id === this.editTarget);
            if (planIndex !== -1) {
                this.productionPlans[planIndex] = {
                    ...this.productionPlans[planIndex],
                    ...updateData
                };
                this.saveToLocalStorage();
                this.updateCalendar();
                this.updateProductionTable();
            }
        }

        this.hideEditModal();
    }

    cancelEdit() {
        this.hideEditModal();
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

    switchToMonthView() {
        this.currentViewMode = 'month';
        document.getElementById('monthViewBtn').classList.add('btn--active');
        document.getElementById('weekViewBtn').classList.remove('btn--active');
        this.updateCalendar();
    }

    switchToWeekView() {
        this.currentViewMode = 'week';
        document.getElementById('weekViewBtn').classList.add('btn--active');
        document.getElementById('monthViewBtn').classList.remove('btn--active');
        this.updateCalendar();
    }

    updateCalendar() {
        if (this.currentViewMode === 'month') {
            this.updateMonthCalendar();
        } else {
            this.updateWeekCalendar();
        }
    }

    // 커스텀 정렬 함수
    sortPlansByProcess(plans) {
        return plans.sort((a, b) => {
            const indexA = this.processOrder.indexOf(a.process_line);
            const indexB = this.processOrder.indexOf(b.process_line);

            // 정의된 순서에 없는 경우 맨 뒤로
            if (indexA === -1 && indexB === -1) return 0;
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;

            return indexA - indexB;
        });
    }

    updateMonthCalendar() {
        const calendar = document.getElementById('productionCalendar');
        const monthDisplay = document.getElementById('currentMonthDisplay');

        // 월 표시 업데이트
        monthDisplay.textContent = `${this.currentMonth.getFullYear()}년 ${this.currentMonth.getMonth() + 1}월`;

        // 달력 생성
        const firstDay = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
        const lastDay = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        let calendarHTML = `
            <div class="calendar-grid">
                <div class="calendar-day-header">일</div>
                <div class="calendar-day-header">월</div>
                <div class="calendar-day-header">화</div>
                <div class="calendar-day-header">수</div>
                <div class="calendar-day-header">목</div>
                <div class="calendar-day-header">금</div>
                <div class="calendar-day-header">토</div>
        `;

        for (let week = 0; week < 6; week++) {
            for (let day = 0; day < 7; day++) {
                const currentDate = new Date(startDate);
                currentDate.setDate(startDate.getDate() + (week * 7) + day);

                const isOtherMonth = currentDate.getMonth() !== this.currentMonth.getMonth();
                const isToday = this.isSameDate(currentDate, new Date());

                let dayClass = 'calendar-day';
                if (isOtherMonth) dayClass += ' calendar-day--other-month';
                if (isToday) dayClass += ' calendar-day--today';

                // 해당 날짜의 생산계획 찾기
                const dayPlans = this.productionPlans.filter(plan => {
                    const planStart = this.parseLocalDate(plan.start_date);
                    const planEnd = this.parseLocalDate(plan.end_date);
                    return this.isDateInRange(currentDate, planStart, planEnd);
                });

                // 공정 순서대로 정렬
                const sortedPlans = this.sortPlansByProcess(dayPlans);

                let plansHTML = '';
                sortedPlans.forEach(plan => {
                    const backgroundColor = this.colorMap[plan.process_line] || '#E6E6E6';
                    plansHTML += `
                        <div class="calendar-plan-item" 
                             style="background-color: ${backgroundColor};"
                             onmouseenter="app.showTooltip(this, '${plan.customer}<br/>${plan.product_name}<br/>수량: ${plan.quantity.toLocaleString('ko-KR')}EA<br/>기간: ${plan.start_date} ~ ${plan.end_date}')">
                            <div class="plan-item-text">${plan.customer}</div>
                            <div class="plan-item-line">${plan.process_line}</div>
                        </div>
                    `;
                });

                calendarHTML += `
                    <div class="${dayClass}">
                        <div class="calendar-day-number">${currentDate.getDate()}</div>
                        ${plansHTML}
                    </div>
                `;

                // 마지막 주가 완성되면 더 이상 진행하지 않음
                if (currentDate.getMonth() !== this.currentMonth.getMonth() && week >= 4) {
                    break;
                }
            }
            
            // 마지막 주 확인
            const weekEndDate = new Date(startDate);
            weekEndDate.setDate(startDate.getDate() + (week * 7) + 6);
            if (weekEndDate.getMonth() !== this.currentMonth.getMonth() && week >= 4) {
                break;
            }
        }

        calendarHTML += '</div>';
        calendar.innerHTML = calendarHTML;
    }

    updateWeekCalendar() {
        const calendar = document.getElementById('productionCalendar');
        const monthDisplay = document.getElementById('currentMonthDisplay');

        // 주 표시 업데이트
        const weekStart = new Date(this.currentWeekStart);
        const weekEnd = new Date(this.currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        monthDisplay.textContent = `${weekStart.getFullYear()}년 ${weekStart.getMonth() + 1}월 ${weekStart.getDate()}일 - ${weekEnd.getMonth() + 1}월 ${weekEnd.getDate()}일`;

        let calendarHTML = `
            <div class="calendar-grid weekly">
                <div class="calendar-day-header">일</div>
                <div class="calendar-day-header">월</div>
                <div class="calendar-day-header">화</div>
                <div class="calendar-day-header">수</div>
                <div class="calendar-day-header">목</div>
                <div class="calendar-day-header">금</div>
                <div class="calendar-day-header">토</div>
        `;

        for (let day = 0; day < 7; day++) {
            const currentDate = new Date(this.currentWeekStart);
            currentDate.setDate(this.currentWeekStart.getDate() + day);

            const isToday = this.isSameDate(currentDate, new Date());

            let dayClass = 'calendar-day calendar-day--week';
            if (isToday) dayClass += ' calendar-day--today';

            // 해당 날짜의 생산계획 찾기
            const dayPlans = this.productionPlans.filter(plan => {
                const planStart = this.parseLocalDate(plan.start_date);
                const planEnd = this.parseLocalDate(plan.end_date);
                return this.isDateInRange(currentDate, planStart, planEnd);
            });

            // 공정 순서대로 정렬
            const sortedPlans = this.sortPlansByProcess(dayPlans);

            let plansHTML = '';
            sortedPlans.forEach(plan => {
                const backgroundColor = this.colorMap[plan.process_line] || '#E6E6E6';
                plansHTML += `
                    <div class="calendar-plan-item" 
                         style="background-color: ${backgroundColor};"
                         onmouseenter="app.showTooltip(this, '${plan.customer}<br/>${plan.product_name}<br/>수량: ${plan.quantity.toLocaleString('ko-KR')}EA<br/>기간: ${plan.start_date} ~ ${plan.end_date}')">
                        <div class="plan-item-text">${plan.customer}</div>
                        <div class="plan-item-line">${plan.process_line}</div>
                    </div>
                `;
            });

            calendarHTML += `
                <div class="${dayClass}">
                    <div class="calendar-day-number">${currentDate.getDate()}</div>
                    ${plansHTML}
                </div>
            `;
        }

        calendarHTML += '</div>';
        calendar.innerHTML = calendarHTML;
    }

    updateProductionTable() {
        const tableBody = document.getElementById('productionTableBody');
        
        if (!tableBody) {
            console.warn('생산계획 테이블을 찾을 수 없습니다');
            return;
        }

        // 테이블 내용 초기화
        tableBody.innerHTML = '';

        if (this.productionPlans.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">등록된 생산계획이 없습니다</td>
                </tr>
            `;
            return;
        }

        // 생산계획 데이터로 테이블 행 생성
        this.productionPlans.forEach(plan => {
            const backgroundColor = this.colorMap[plan.process_line] || '#E6E6E6';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${plan.customer}</td>
                <td>${plan.product_id}</td>
                <td>${plan.product_name}</td>
                <td>${plan.quantity.toLocaleString('ko-KR')} EA</td>
                <td>
                    <span class="process-line-badge" style="background-color: ${backgroundColor};">
                        ${plan.process_line}
                    </span>
                </td>
                <td>${plan.start_date}</td>
                <td>${plan.end_date}</td>
                <td>
                    <button class="btn btn--small btn--secondary" onclick="app.editPlan('${plan.id}')">편집</button>
                    <button class="btn btn--small btn--danger" onclick="app.deletePlan('${plan.id}')">삭제</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    updateConnectionStatus(elementId, status) {
        const statusElement = document.getElementById(elementId);
        if (!statusElement) return;

        const statusDot = statusElement.querySelector('.status-dot');
        
        // 모든 상태 클래스 제거
        statusDot.classList.remove('status-dot--connecting', 'status-dot--connected', 'status-dot--error');
        
        // 새로운 상태 클래스 추가
        statusDot.classList.add(`status-dot--${status}`);
    }

    updateSaveStatus(status) {
        const saveStatusElement = document.getElementById('saveStatus');
        if (!saveStatusElement) return;

        const statusDot = saveStatusElement.querySelector('.status-dot');
        const statusText = saveStatusElement.querySelector('span');
        
        // 모든 상태 클래스 제거
        statusDot.classList.remove('status-dot--saving', 'status-dot--saved', 'status-dot--error');
        
        // 새로운 상태 클래스 추가 및 텍스트 변경
        switch(status) {
            case 'saving':
                statusDot.classList.add('status-dot--saving');
                statusText.textContent = '저장 중...';
                break;
            case 'saved':
                statusDot.classList.add('status-dot--saved');
                statusText.textContent = '저장 완료';
                break;
            case 'error':
                statusDot.classList.add('status-dot--error');
                statusText.textContent = '저장 실패';
                break;
        }
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem('productionPlans', JSON.stringify(this.productionPlans));
            this.updateSaveStatus('saved');
        } catch (error) {
            console.error('로컬 저장 오류:', error);
            this.updateSaveStatus('error');
        }
    }

    loadFromLocalStorage() {
        try {
            const savedPlans = localStorage.getItem('productionPlans');
            if (savedPlans) {
                this.productionPlans = JSON.parse(savedPlans);
            }
        } catch (error) {
            console.error('로컬 로드 오류:', error);
            this.productionPlans = [];
        }
    }

    showToast(message, type = 'info') {
        // 토스트 컨테이너 생성 (없는 경우)
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }

        // 토스트 엘리먼트 생성
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.textContent = message;

        // 토스트 컨테이너에 추가
        toastContainer.appendChild(toast);

        // 애니메이션을 위해 잠시 후 show 클래스 추가
        setTimeout(() => {
            toast.classList.add('toast--show');
        }, 100);

        // 3초 후 토스트 제거
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

// 애플리케이션 초기화
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new ProductionPlannerApp();
});
