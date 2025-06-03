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

        // 공정라인 색상 매핑 (11개 공정) - 시인성 강화
        this.colorMap = {
            'PTP1': '#E31A1C',        // 진한 빨간색
            'PTP2': '#1F78B4',        // 진한 파란색
            '분말스틱1': '#33A02C',    // 진한 초록색
            '분말스틱2': '#FF7F00',    // 진한 주황색
            '분말스틱3': '#6A3D9A',    // 진한 보라색
            '칭량': '#A6CEE3',         // 연한 파란색
            '과립': '#B2DF8A',         // 연한 초록색
            '혼합': '#FB9A99',         // 연한 빨간색
            '타정': '#FDBF6F',         // 연한 주황색
            '코팅': '#CAB2D6',         // 연한 보라색
            '선별': '#FFFF99'          // 노란색
        };

        // 공정 순서 정의
        this.processOrder = [
            'PTP1', 'PTP2', '분말스틱1', '분말스틱2', '분말스틱3',
            '칭량', '과립', '혼합', '타정', '코팅', '선별'
        ];

        this.init();
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
                this.productionPlans[planIndex] = { ...this.productionPlans[planIndex], ...updateData };
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

        const today = new Date();
        const currentDate = new Date(startDate);

        for (let week = 0; week < 6; week++) {
            for (let day = 0; day < 7; day++) {
                const dateStr = currentDate.toISOString().split('T')[0];
                const dayPlans = this.productionPlans.filter(plan => 
                    dateStr >= plan.start_date && dateStr <= plan.end_date
                );

                // 공정 순서에 따라 정렬
                const sortedPlans = this.sortPlansByProcess(dayPlans);

                let dayClass = 'calendar-day';
                if (currentDate.getMonth() !== this.currentMonth.getMonth()) {
                    dayClass += ' calendar-day--other-month';
                }
                if (currentDate.toDateString() === today.toDateString()) {
                    dayClass += ' calendar-day--today';
                }

                calendarHTML += `
                    <div class="${dayClass}">
                        <div class="calendar-day-number">${currentDate.getDate()}</div>
                `;

                sortedPlans.forEach(plan => {
                    const planDiv = document.createElement('div');
                    planDiv.className = 'calendar-plan-item';
                    planDiv.style.backgroundColor = this.colorMap[plan.process_line] || '#999';
                    
                    // 제품명(제조번호) 형태로 변경
                    const displayName = `${plan.product_name}(${plan.product_id})`;
                    
                    calendarHTML += `
                        <div class="calendar-plan-item" 
                             style="background-color: ${this.colorMap[plan.process_line] || '#999'}"
                             onmouseenter="app.showTooltip(this, \`
                                <strong>${plan.customer}</strong><br>
                                제품: ${plan.product_name}<br>
                                제조번호: ${plan.product_id}<br>
                                수량: ${plan.quantity.toLocaleString()}EA<br>
                                공정: ${plan.process_line}<br>
                                기간: ${plan.start_date} ~ ${plan.end_date}
                             \`)">
                            <div class="plan-item-text">${displayName}</div>
                            <div class="plan-item-line">${plan.quantity.toLocaleString()}EA / ${plan.process_line}</div>
                        </div>
                    `;
                });

                calendarHTML += `</div>`;
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        calendarHTML += `</div>`;
        calendar.innerHTML = calendarHTML;
    }

    updateWeekCalendar() {
        const calendar = document.getElementById('productionCalendar');
        const monthDisplay = document.getElementById('currentMonthDisplay');

        // 주간 표시 업데이트
        const weekEnd = new Date(this.currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        monthDisplay.textContent = `${this.currentWeekStart.getMonth() + 1}월 ${this.currentWeekStart.getDate()}일 - ${weekEnd.getMonth() + 1}월 ${weekEnd.getDate()}일`;

        let calendarHTML = `
            <div class="calendar-grid weekly">
                <div class="calendar-day-header">월</div>
                <div class="calendar-day-header">화</div>
                <div class="calendar-day-header">수</div>
                <div class="calendar-day-header">목</div>
                <div class="calendar-day-header">금</div>
                <div class="calendar-day-header">토</div>
                <div class="calendar-day-header">일</div>
        `;

        const today = new Date();
        const currentDate = new Date(this.currentWeekStart);

        for (let day = 0; day < 7; day++) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const dayPlans = this.productionPlans.filter(plan => 
                dateStr >= plan.start_date && dateStr <= plan.end_date
            );

            // 공정 순서에 따라 정렬
            const sortedPlans = this.sortPlansByProcess(dayPlans);

            let dayClass = 'calendar-day calendar-day--week';
            if (currentDate.toDateString() === today.toDateString()) {
                dayClass += ' calendar-day--today';
            }

            calendarHTML += `
                <div class="${dayClass}">
                    <div class="calendar-day-number">${currentDate.getDate()}</div>
            `;

            sortedPlans.forEach(plan => {
                // 제품명(제조번호) 형태로 변경
                const displayName = `${plan.product_name}(${plan.product_id})`;
                
                calendarHTML += `
                    <div class="calendar-plan-item" 
                         style="background-color: ${this.colorMap[plan.process_line] || '#999'}"
                         onmouseenter="app.showTooltip(this, \`
                            <strong>${plan.customer}</strong><br>
                            제품: ${plan.product_name}<br>
                            제조번호: ${plan.product_id}<br>
                            수량: ${plan.quantity.toLocaleString()}EA<br>
                            공정: ${plan.process_line}<br>
                            기간: ${plan.start_date} ~ ${plan.end_date}
                         \`)">
                        <div class="plan-item-text">${displayName}</div>
                        <div class="plan-item-line">${plan.quantity.toLocaleString()}EA / ${plan.process_line}</div>
                    </div>
                `;
            });

            calendarHTML += `</div>`;
            currentDate.setDate(currentDate.getDate() + 1);
        }

        calendarHTML += `</div>`;
        calendar.innerHTML = calendarHTML;
    }

    updateProductionTable() {
        const tableBody = document.querySelector('.production-table tbody');
        if (!tableBody) return;

        tableBody.innerHTML = '';

        // 시작일 기준으로 정렬
        const sortedPlans = [...this.productionPlans].sort((a, b) => 
            new Date(a.start_date) - new Date(b.start_date)
        );

        sortedPlans.forEach(plan => {
            const row = document.createElement('tr');
            
            const processColor = this.colorMap[plan.process_line] || '#999';
            
            row.innerHTML = `
                <td>${plan.customer}</td>
                <td>${plan.product_id}</td>
                <td>${plan.product_name}</td>
                <td class="text-center">${plan.quantity.toLocaleString()}</td>
                <td class="text-center">
                    <span class="process-line-badge" style="background-color: ${processColor}; color: white; padding: 4px 8px; border-radius: 4px;">
                        ${plan.process_line}
                    </span>
                </td>
                <td class="text-center">${plan.start_date}</td>
                <td class="text-center">${plan.end_date}</td>
                <td class="text-center">
                    <button class="btn btn--small btn--secondary" onclick="app.editPlan('${plan.id}')">수정</button>
                    <button class="btn btn--small btn--danger" onclick="app.deletePlan('${plan.id}')">삭제</button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    }

    updateConnectionStatus(elementId, status) {
        const statusElement = document.getElementById(elementId);
        if (!statusElement) return;

        const dot = statusElement.querySelector('.status-dot');
        const text = statusElement.querySelector('span:last-child');

        dot.className = `status-dot status-dot--${status}`;

        switch (status) {
            case 'connecting':
                text.textContent = '연결 중...';
                break;
            case 'connected':
                text.textContent = '연결됨';
                break;
            case 'error':
                text.textContent = '연결 실패';
                break;
        }
    }

    updateSaveStatus(status) {
        const statusElement = document.getElementById('saveStatus');
        if (!statusElement) return;

        const dot = statusElement.querySelector('.status-dot');
        const text = statusElement.querySelector('span:last-child');

        dot.className = `status-dot status-dot--${status}`;

        switch (status) {
            case 'saving':
                text.textContent = '저장 중...';
                break;
            case 'saved':
                text.textContent = '저장 완료';
                break;
            case 'error':
                text.textContent = '저장 실패';
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
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.textContent = message;

        toastContainer.appendChild(toast);

        // 애니메이션 적용
        setTimeout(() => {
            toast.classList.add('toast--show');
        }, 10);

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
}

// 앱 초기화
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new ProductionPlannerApp();
});
