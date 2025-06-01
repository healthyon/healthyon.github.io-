// 생산계획 관리 시스템 - Supabase 실시간 연동
class ProductionPlanManager {
    constructor() {
        // Supabase 설정
        this.supabase = null;
        this.supabaseConfig = {
            url: 'https://kyspwjebzbozuzhgngxm.supabase.co',
            anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5c3B3amViemJvenV6aGduZ3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3MTk0MTUsImV4cCI6MjA2NDI5NTQxNX0.10iosLA08Q__Y7E6aJgtOWt5_AEYS783kHxSSXsf9Po'
        };
        
        // 초기 데이터 설정
        this.plans = [
            {
                id: 'plan_001',
                customer: 'ABC Corporation',
                productId: 'PRD-2025-001',
                productName: '프로틴 파우더 A타입',
                quantity: 500000,
                processLine: 'PTP1',
                startDate: '2025-06-05',
                endDate: '2025-06-10',
                createdAt: '2025-06-01T00:00:00Z'
            },
            {
                id: 'plan_002',
                customer: 'XYZ Limited',
                productId: 'PRD-2025-002',
                productName: '비타민 스틱 B타입',
                quantity: 1500000,
                processLine: '분말스틱1',
                startDate: '2025-06-03',
                endDate: '2025-06-07',
                createdAt: '2025-06-01T00:00:00Z'
            }
        ];
        
        // 현재 날짜 기준으로 월 설정
        const today = new Date();
        this.currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        // 공정라인 색상 매핑
        this.processColors = {
            'PTP1': '#6c63ff',
            'PTP2': '#4CAF50',
            '분말스틱1': '#FF9800',
            '분말스틱2': '#E91E63',
            '분말스틱3': '#9C27B0'
        };
        
        // 상태 관리
        this.connectionStatus = 'disconnected'; // disconnected, connecting, connected, error
        this.isOnline = navigator.onLine;
        this.lastSyncTime = null;
        this.autoSaveEnabled = true;
        this.saveInProgress = false;
        this.planToDelete = null;
        
        // 타이머
        this.connectionCheckTimer = null;
        this.autoSaveTimer = null;
        this.toastTimer = null;
        
        // DOM 요소 참조
        this.elements = {};
        
        // 초기화
        this.initialize();
    }
    
    // 애플리케이션 초기화
    async initialize() {
        try {
            // DOM 요소 초기화
            this.initializeElements();
            
            // 이벤트 리스너 설정
            this.setupEventListeners();
            
            // 로컬 스토리지에서 데이터 로드
            this.loadFromLocalStorage();
            
            // UI 초기 업데이트
            this.updateCalendar();
            this.updatePlansList();
            this.updateConnectionStatus();
            this.updateSyncStatus();
            
            // 폼 기본값 설정
            this.setFormDefaults();
            
            // Supabase 연결 모달 표시
            this.showModal('supabaseModal');
            
            // 네트워크 상태 모니터링
            this.setupNetworkMonitoring();
            
            console.log('생산계획 관리 시스템이 초기화되었습니다.');
        } catch (error) {
            console.error('초기화 오류:', error);
            this.showToast('시스템 초기화 중 오류가 발생했습니다.', 'error');
        }
    }
    
    // DOM 요소 초기화
    initializeElements() {
        const elementIds = [
            'supabaseModal', 'deleteModal', 'supabaseUrl', 'supabaseKey',
            'connectSupabase', 'skipSupabase', 'confirmDelete', 'cancelDelete',
            'deleteMessage', 'connectionStatus', 'syncStatus', 'lastSyncTime',
            'autoSaveStatus', 'planForm', 'customer', 'productId', 'productName',
            'quantity', 'processLine', 'startDate', 'endDate', 'submitText',
            'saveButton', 'saveButtonText', 'calendar', 'currentMonth',
            'prevMonth', 'nextMonth', 'plansList', 'planCount', 'tooltip', 'toast'
        ];
        
        elementIds.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });
    }
    
    // 이벤트 리스너 설정
    setupEventListeners() {
        // Supabase 연결 관련
        this.elements.connectSupabase?.addEventListener('click', () => this.connectToSupabase());
        this.elements.skipSupabase?.addEventListener('click', () => this.skipSupabaseConnection());
        
        // 삭제 확인 관련
        this.elements.confirmDelete?.addEventListener('click', () => this.executeDelete());
        this.elements.cancelDelete?.addEventListener('click', () => this.cancelDelete());
        
        // 폼 제출 및 저장
        this.elements.planForm?.addEventListener('submit', (e) => this.handleFormSubmit(e));
        this.elements.saveButton?.addEventListener('click', () => this.manualSave());
        
        // 수주량 포맷팅
        this.elements.quantity?.addEventListener('input', (e) => this.formatQuantity(e));
        
        // 달력 네비게이션
        this.elements.prevMonth?.addEventListener('click', () => this.changeMonth(-1));
        this.elements.nextMonth?.addEventListener('click', () => this.changeMonth(1));
        
        // 키보드 이벤트
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
        
        // 모달 외부 클릭시 닫기
        this.elements.supabaseModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.supabaseModal) {
                this.skipSupabaseConnection();
            }
        });
        
        this.elements.deleteModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.deleteModal) {
                this.cancelDelete();
            }
        });
        
        // 토스트 닫기
        const toastClose = this.elements.toast?.querySelector('.toast-close');
        toastClose?.addEventListener('click', () => this.hideToast());
    }
    
    // 네트워크 상태 모니터링
    setupNetworkMonitoring() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showToast('네트워크 연결이 복구되었습니다.', 'success');
            this.checkConnection();
            if (this.hasUnsyncedData()) {
                this.syncOfflineData();
            }
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.connectionStatus = 'disconnected';
            this.updateConnectionStatus();
            this.showToast('네트워크 연결이 끊어졌습니다. 오프라인 모드로 전환합니다.', 'warning');
        });
    }
    
    // Supabase 연결
    async connectToSupabase() {
        try {
            this.showLoading('connectSupabase', '연결 중...');
            this.connectionStatus = 'connecting';
            this.updateConnectionStatus();
            
            // Supabase 클라이언트 초기화
            this.supabase = window.supabase.createClient(
                this.supabaseConfig.url,
                this.supabaseConfig.anonKey
            );
            
            // 연결 테스트
            const { data, error } = await this.supabase
                .from('production_plans')
                .select('count')
                .limit(1);
            
            if (error && error.code !== 'PGRST116') { // 테이블이 없는 경우는 무시
                throw error;
            }
            
            this.connectionStatus = 'connected';
            this.updateConnectionStatus();
            
            // 기존 데이터 로드
            await this.loadFromSupabase();
            
            // 실시간 구독 설정
            this.setupRealtimeSubscription();
            
            // 자동 저장 타이머 시작
            this.setupAutoSave();
            
            // 연결 상태 체크 타이머
            this.startConnectionCheck();
            
            this.closeModal('supabaseModal');
            this.showToast('Supabase에 성공적으로 연결되었습니다! 🎉', 'success');
            
        } catch (error) {
            console.error('Supabase 연결 오류:', error);
            this.connectionStatus = 'error';
            this.updateConnectionStatus();
            this.showToast(`연결 실패: ${error.message}`, 'error');
        } finally {
            this.hideLoading('connectSupabase', '연결하기');
        }
    }
    
    // Supabase 연결 건너뛰기
    skipSupabaseConnection() {
        this.connectionStatus = 'disconnected';
        this.updateConnectionStatus();
        this.closeModal('supabaseModal');
        this.showToast('오프라인 모드로 시작합니다. 데이터는 브라우저에만 저장됩니다.', 'info');
    }
    
    // Supabase에서 데이터 로드
    async loadFromSupabase() {
        if (!this.supabase) return;
        
        try {
            const { data, error } = await this.supabase
                .from('production_plans')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('데이터 로드 오류:', error);
                return;
            }
            
            if (data && data.length > 0) {
                this.plans = data.map(item => ({
                    id: item.id,
                    customer: item.customer,
                    productId: item.product_id,
                    productName: item.product_name,
                    quantity: item.quantity,
                    processLine: item.process_line,
                    startDate: item.start_date,
                    endDate: item.end_date,
                    createdAt: item.created_at
                }));
                
                this.updateCalendar();
                this.updatePlansList();
                this.lastSyncTime = new Date();
                this.updateSyncStatus();
                
                console.log(`${data.length}개의 생산계획을 로드했습니다.`);
            }
        } catch (error) {
            console.error('Supabase 로드 오류:', error);
        }
    }
    
    // Supabase에 데이터 저장
    async saveToSupabase(planData = null) {
        if (!this.supabase || this.saveInProgress) return false;
        
        try {
            this.saveInProgress = true;
            
            if (planData) {
                // 개별 계획 저장
                const { data, error } = await this.supabase
                    .from('production_plans')
                    .insert([{
                        id: planData.id,
                        customer: planData.customer,
                        product_id: planData.productId,
                        product_name: planData.productName,
                        quantity: planData.quantity,
                        process_line: planData.processLine,
                        start_date: planData.startDate,
                        end_date: planData.endDate,
                        created_at: planData.createdAt
                    }]);
                
                if (error) throw error;
            } else {
                // 전체 동기화 (주의: 기존 데이터 삭제 후 새로 삽입)
                // 실제 환경에서는 더 정교한 동기화 로직이 필요
                await this.supabase.from('production_plans').delete().gte('id', '');
                
                if (this.plans.length > 0) {
                    const insertData = this.plans.map(plan => ({
                        id: plan.id,
                        customer: plan.customer,
                        product_id: plan.productId,
                        product_name: plan.productName,
                        quantity: plan.quantity,
                        process_line: plan.processLine,
                        start_date: plan.startDate,
                        end_date: plan.endDate,
                        created_at: plan.createdAt
                    }));
                    
                    const { data, error } = await this.supabase
                        .from('production_plans')
                        .insert(insertData);
                    
                    if (error) throw error;
                }
            }
            
            this.lastSyncTime = new Date();
            this.updateSyncStatus();
            this.saveToLocalStorage(); // 로컬 백업도 업데이트
            
            return true;
        } catch (error) {
            console.error('Supabase 저장 오류:', error);
            this.showToast(`저장 실패: ${error.message}`, 'error');
            return false;
        } finally {
            this.saveInProgress = false;
        }
    }
    
    // 계획 삭제 (Supabase)
    async deleteFromSupabase(planId) {
        if (!this.supabase) return false;
        
        try {
            const { error } = await this.supabase
                .from('production_plans')
                .delete()
                .eq('id', planId);
            
            if (error) throw error;
            
            this.lastSyncTime = new Date();
            this.updateSyncStatus();
            return true;
        } catch (error) {
            console.error('Supabase 삭제 오류:', error);
            this.showToast(`삭제 실패: ${error.message}`, 'error');
            return false;
        }
    }
    
    // 실시간 구독 설정
    setupRealtimeSubscription() {
        if (!this.supabase) return;
        
        this.supabase
            .channel('production_plans_changes')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'production_plans' },
                (payload) => {
                    console.log('실시간 변경사항:', payload);
                    // 실시간 업데이트 처리
                    this.handleRealtimeUpdate(payload);
                }
            )
            .subscribe();
    }
    
    // 실시간 업데이트 처리
    handleRealtimeUpdate(payload) {
        switch (payload.eventType) {
            case 'INSERT':
                this.showToast('새 생산계획이 추가되었습니다.', 'info');
                this.loadFromSupabase();
                break;
            case 'DELETE':
                this.showToast('생산계획이 삭제되었습니다.', 'info');
                this.loadFromSupabase();
                break;
            case 'UPDATE':
                this.showToast('생산계획이 수정되었습니다.', 'info');
                this.loadFromSupabase();
                break;
        }
    }
    
    // 연결 상태 체크
    async checkConnection() {
        if (!this.supabase || !this.isOnline) {
            this.connectionStatus = 'disconnected';
            this.updateConnectionStatus();
            return;
        }
        
        try {
            const { data, error } = await this.supabase
                .from('production_plans')
                .select('count')
                .limit(1);
            
            if (error && error.code !== 'PGRST116') {
                throw error;
            }
            
            this.connectionStatus = 'connected';
        } catch (error) {
            this.connectionStatus = 'error';
            console.error('연결 체크 오류:', error);
        }
        
        this.updateConnectionStatus();
    }
    
    // 연결 상태 체크 타이머 시작
    startConnectionCheck() {
        if (this.connectionCheckTimer) {
            clearInterval(this.connectionCheckTimer);
        }
        
        this.connectionCheckTimer = setInterval(() => {
            this.checkConnection();
        }, 30000); // 30초마다 체크
    }
    
    // 자동 저장 설정
    setupAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
        
        if (this.autoSaveEnabled && this.supabase) {
            this.autoSaveTimer = setInterval(async () => {
                if (this.plans.length > 0 && !this.saveInProgress) {
                    const success = await this.saveToSupabase();
                    if (success) {
                        console.log('자동 저장 완료');
                    }
                }
            }, 60000); // 1분마다 자동 저장
        }
    }
    
    // 수동 저장
    async manualSave() {
        try {
            this.showLoading('saveButtonText', '저장 중...');
            
            if (this.supabase) {
                const success = await this.saveToSupabase();
                if (success) {
                    this.showToast('데이터가 성공적으로 저장되었습니다! 💾', 'success');
                } else {
                    this.showToast('저장 중 오류가 발생했습니다.', 'error');
                }
            } else {
                this.saveToLocalStorage();
                this.showToast('로컬 스토리지에 저장되었습니다.', 'info');
            }
        } catch (error) {
            console.error('수동 저장 오류:', error);
            this.showToast('저장 중 오류가 발생했습니다.', 'error');
        } finally {
            this.hideLoading('saveButtonText', '💾 수동 저장');
        }
    }
    
    // 로컬 스토리지 저장
    saveToLocalStorage() {
        try {
            const data = {
                plans: this.plans,
                lastSyncTime: this.lastSyncTime?.toISOString(),
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('production_plans_backup', JSON.stringify(data));
        } catch (error) {
            console.error('로컬 스토리지 저장 오류:', error);
        }
    }
    
    // 로컬 스토리지 로드
    loadFromLocalStorage() {
        try {
            const data = localStorage.getItem('production_plans_backup');
            if (data) {
                const parsed = JSON.parse(data);
                if (parsed.plans && Array.isArray(parsed.plans)) {
                    this.plans = parsed.plans;
                    if (parsed.lastSyncTime) {
                        this.lastSyncTime = new Date(parsed.lastSyncTime);
                    }
                    console.log('로컬 스토리지에서 데이터를 로드했습니다.');
                }
            }
        } catch (error) {
            console.error('로컬 스토리지 로드 오류:', error);
        }
    }
    
    // 미동기화 데이터 확인
    hasUnsyncedData() {
        const localData = localStorage.getItem('production_plans_backup');
        if (!localData) return false;
        
        try {
            const parsed = JSON.parse(localData);
            return parsed.plans && parsed.plans.length > 0;
        } catch {
            return false;
        }
    }
    
    // 오프라인 데이터 동기화
    async syncOfflineData() {
        if (!this.hasUnsyncedData() || !this.supabase) return;
        
        try {
            this.showToast('오프라인 데이터를 동기화하는 중...', 'info');
            const success = await this.saveToSupabase();
            if (success) {
                this.showToast('오프라인 데이터 동기화가 완료되었습니다!', 'success');
            }
        } catch (error) {
            console.error('오프라인 데이터 동기화 오류:', error);
            this.showToast('동기화 중 오류가 발생했습니다.', 'error');
        }
    }
    
    // 폼 기본값 설정
    setFormDefaults() {
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);
        
        if (this.elements.startDate) {
            this.elements.startDate.value = this.formatDateForInput(today);
        }
        if (this.elements.endDate) {
            this.elements.endDate.value = this.formatDateForInput(nextWeek);
        }
    }
    
    // 폼 제출 처리
    async handleFormSubmit(e) {
        e.preventDefault();
        
        const formData = {
            id: 'plan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            customer: this.elements.customer?.value.trim(),
            productId: this.elements.productId?.value.trim(),
            productName: this.elements.productName?.value.trim(),
            quantity: parseInt(this.elements.quantity?.value.replace(/,/g, '')),
            processLine: this.elements.processLine?.value,
            startDate: this.elements.startDate?.value,
            endDate: this.elements.endDate?.value,
            createdAt: new Date().toISOString()
        };
        
        if (!this.validateForm(formData)) return;
        
        try {
            this.showLoading('submitText', '저장 중...');
            
            // 로컬 배열에 추가
            this.plans.push(formData);
            
            // UI 즉시 업데이트
            this.updateCalendar();
            this.updatePlansList();
            
            // Supabase에 저장
            if (this.supabase) {
                const success = await this.saveToSupabase(formData);
                if (success) {
                    this.showToast('생산계획이 성공적으로 등록되었습니다! 🎉', 'success');
                } else {
                    this.showToast('등록되었지만 서버 저장에 실패했습니다. 나중에 다시 동기화됩니다.', 'warning');
                }
            } else {
                this.saveToLocalStorage();
                this.showToast('생산계획이 로컬에 저장되었습니다.', 'info');
            }
            
            // 폼 초기화
            this.elements.planForm?.reset();
            this.setFormDefaults();
            
        } catch (error) {
            console.error('계획 등록 오류:', error);
            this.showToast('등록 중 오류가 발생했습니다.', 'error');
            // 롤백
            this.plans.pop();
            this.updateCalendar();
            this.updatePlansList();
        } finally {
            this.hideLoading('submitText', '📋 계획 등록');
        }
    }
    
    // 폼 유효성 검사
    validateForm(data) {
        const fields = [
            { key: 'customer', name: '고객사' },
            { key: 'productId', name: '제조번호' },
            { key: 'productName', name: '제품명' },
            { key: 'quantity', name: '수주량' },
            { key: 'processLine', name: '공정라인' },
            { key: 'startDate', name: '시작일' },
            { key: 'endDate', name: '완료일' }
        ];
        
        for (const field of fields) {
            if (!data[field.key]) {
                this.showToast(`${field.name}을(를) 입력해주세요.`, 'warning');
                this.elements[field.key]?.focus();
                return false;
            }
        }
        
        if (data.quantity <= 0) {
            this.showToast('수주량은 0보다 큰 값을 입력해주세요.', 'warning');
            this.elements.quantity?.focus();
            return false;
        }
        
        if (new Date(data.startDate) > new Date(data.endDate)) {
            this.showToast('시작일은 완료일보다 빨라야 합니다.', 'warning');
            this.elements.startDate?.focus();
            return false;
        }
        
        return true;
    }
    
    // 계획 삭제 확인
    confirmDeletePlan(planId) {
        const plan = this.plans.find(p => p.id === planId);
        if (!plan) return;
        
        this.planToDelete = planId;
        this.elements.deleteMessage.textContent = `"${plan.productName}" 계획을 삭제하시겠습니까?`;
        this.showModal('deleteModal');
    }
    
    // 삭제 실행
    async executeDelete() {
        if (!this.planToDelete) return;
        
        try {
            this.showLoading('confirmDelete', '삭제 중...');
            
            // 로컬에서 삭제
            this.plans = this.plans.filter(plan => plan.id !== this.planToDelete);
            
            // UI 업데이트
            this.updateCalendar();
            this.updatePlansList();
            
            // Supabase에서 삭제
            if (this.supabase) {
                const success = await this.deleteFromSupabase(this.planToDelete);
                if (success) {
                    this.showToast('생산계획이 삭제되었습니다.', 'success');
                } else {
                    this.showToast('로컬에서 삭제되었지만 서버 동기화에 실패했습니다.', 'warning');
                }
            } else {
                this.saveToLocalStorage();
                this.showToast('생산계획이 삭제되었습니다.', 'success');
            }
            
            this.closeModal('deleteModal');
            this.planToDelete = null;
            
        } catch (error) {
            console.error('삭제 오류:', error);
            this.showToast('삭제 중 오류가 발생했습니다.', 'error');
        } finally {
            this.hideLoading('confirmDelete', '삭제');
        }
    }
    
    // 삭제 취소
    cancelDelete() {
        this.closeModal('deleteModal');
        this.planToDelete = null;
    }
    
    // 수주량 천단위 콤마 포맷팅
    formatQuantity(e) {
        let value = e.target.value.replace(/,/g, '');
        if (value && !isNaN(value)) {
            e.target.value = parseInt(value).toLocaleString();
        }
    }
    
    // 숫자 포맷팅
    formatNumber(number) {
        return number.toLocaleString('ko-KR');
    }
    
    // 날짜 포맷팅
    formatDateForInput(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // 달력 업데이트
    updateCalendar() {
        if (!this.elements.calendar) return;
        
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        
        // 월 표시 업데이트
        if (this.elements.currentMonth) {
            this.elements.currentMonth.textContent = `${year}년 ${month + 1}월`;
        }
        
        // 달력 그리드 생성
        this.elements.calendar.innerHTML = '';
        
        // 요일 헤더
        const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
        weekdays.forEach(day => {
            const headerCell = document.createElement('div');
            headerCell.className = 'calendar-header-cell';
            headerCell.textContent = day;
            this.elements.calendar.appendChild(headerCell);
        });
        
        // 달력 셀 생성
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());
        
        const today = new Date();
        
        for (let i = 0; i < 42; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            
            const cell = document.createElement('div');
            cell.className = 'calendar-cell';
            
            if (currentDate.getMonth() !== month) {
                cell.classList.add('other-month');
            }
            
            if (currentDate.toDateString() === today.toDateString()) {
                cell.classList.add('today');
            }
            
            const dateDiv = document.createElement('div');
            dateDiv.className = 'calendar-date';
            dateDiv.textContent = currentDate.getDate();
            cell.appendChild(dateDiv);
            
            const plansDiv = document.createElement('div');
            plansDiv.className = 'calendar-plans';
            
            const dayPlans = this.getPlansForDate(currentDate);
            dayPlans.forEach(plan => {
                const planDiv = document.createElement('div');
                planDiv.className = 'calendar-plan';
                planDiv.style.backgroundColor = this.processColors[plan.processLine];
                planDiv.textContent = plan.productName;
                planDiv.addEventListener('mouseenter', (e) => this.showTooltip(e, plan));
                planDiv.addEventListener('mouseleave', () => this.hideTooltip());
                plansDiv.appendChild(planDiv);
            });
            
            cell.appendChild(plansDiv);
            this.elements.calendar.appendChild(cell);
        }
    }
    
    // 특정 날짜의 계획 가져오기
    getPlansForDate(date) {
        const dateString = date.toISOString().split('T')[0];
        return this.plans.filter(plan => {
            return dateString >= plan.startDate && dateString <= plan.endDate;
        });
    }
    
    // 달 변경
    changeMonth(direction) {
        this.currentMonth.setMonth(this.currentMonth.getMonth() + direction);
        this.updateCalendar();
    }
    
    // 계획 목록 업데이트
    updatePlansList() {
        if (!this.elements.plansList || !this.elements.planCount) return;
        
        this.elements.planCount.textContent = `총 ${this.plans.length}개`;
        
        if (this.plans.length === 0) {
            this.elements.plansList.innerHTML = `
                <div class="no-plans">
                    <p>등록된 생산계획이 없습니다.</p>
                    <p>위 폼을 통해 새 계획을 등록해보세요! 🚀</p>
                </div>
            `;
            return;
        }
        
        this.elements.plansList.innerHTML = '';
        
        const sortedPlans = [...this.plans].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        
        sortedPlans.forEach(plan => {
            const planElement = this.createPlanElement(plan);
            this.elements.plansList.appendChild(planElement);
        });
    }
    
    // 계획 요소 생성
    createPlanElement(plan) {
        const planDiv = document.createElement('div');
        planDiv.className = 'plan-item';
        planDiv.style.setProperty('--color-primary', this.processColors[plan.processLine]);
        
        planDiv.innerHTML = `
            <div class="plan-header">
                <h3 class="plan-title">${plan.productName}</h3>
                <span class="plan-process" style="background-color: ${this.processColors[plan.processLine]}">
                    ${plan.processLine}
                </span>
            </div>
            <div class="plan-details">
                <div class="plan-detail">
                    <span class="plan-detail-label">고객사:</span>
                    <span class="plan-detail-value">${plan.customer}</span>
                </div>
                <div class="plan-detail">
                    <span class="plan-detail-label">제조번호:</span>
                    <span class="plan-detail-value">${plan.productId}</span>
                </div>
                <div class="plan-detail">
                    <span class="plan-detail-label">수주량:</span>
                    <span class="plan-detail-value">${this.formatNumber(plan.quantity)} EA</span>
                </div>
                <div class="plan-detail">
                    <span class="plan-detail-label">기간:</span>
                    <span class="plan-detail-value">${plan.startDate} ~ ${plan.endDate}</span>
                </div>
            </div>
            <div class="plan-actions">
                <button class="btn btn--error btn--sm" onclick="window.planManager.confirmDeletePlan('${plan.id}')">
                    🗑️ 삭제
                </button>
            </div>
        `;
        
        return planDiv;
    }
    
    // 연결 상태 업데이트
    updateConnectionStatus() {
        if (!this.elements.connectionStatus) return;
        
        const statusElement = this.elements.connectionStatus;
        
        switch (this.connectionStatus) {
            case 'connected':
                statusElement.className = 'status status--success';
                statusElement.textContent = '🟢 Supabase 연결됨';
                break;
            case 'connecting':
                statusElement.className = 'status status--info';
                statusElement.textContent = '🔄 연결 중...';
                break;
            case 'error':
                statusElement.className = 'status status--error';
                statusElement.textContent = '🔴 연결 오류';
                break;
            default:
                statusElement.className = 'status status--warning';
                statusElement.textContent = '⚠️ 오프라인 모드';
        }
    }
    
    // 동기화 상태 업데이트
    updateSyncStatus() {
        if (!this.elements.lastSyncTime) return;
        
        if (this.lastSyncTime) {
            const timeStr = this.lastSyncTime.toLocaleTimeString('ko-KR');
            this.elements.lastSyncTime.textContent = `마지막 저장: ${timeStr}`;
        } else {
            this.elements.lastSyncTime.textContent = '마지막 저장: -';
        }
        
        if (this.elements.autoSaveStatus) {
            this.elements.autoSaveStatus.textContent = this.autoSaveEnabled ? '자동 저장 켜짐' : '자동 저장 꺼짐';
            this.elements.autoSaveStatus.className = this.autoSaveEnabled ? 'autosave-badge' : 'autosave-badge disabled';
        }
    }
    
    // 툴팁 표시
    showTooltip(e, plan) {
        if (!this.elements.tooltip) return;
        
        const tooltip = this.elements.tooltip;
        
        tooltip.innerHTML = `
            <div class="tooltip-title">${plan.productName}</div>
            <div class="tooltip-detail">
                <span>고객사:</span>
                <span>${plan.customer}</span>
            </div>
            <div class="tooltip-detail">
                <span>제조번호:</span>
                <span>${plan.productId}</span>
            </div>
            <div class="tooltip-detail">
                <span>수주량:</span>
                <span>${this.formatNumber(plan.quantity)} EA</span>
            </div>
            <div class="tooltip-detail">
                <span>공정라인:</span>
                <span>${plan.processLine}</span>
            </div>
            <div class="tooltip-detail">
                <span>기간:</span>
                <span>${plan.startDate} ~ ${plan.endDate}</span>
            </div>
        `;
        
        tooltip.style.left = e.pageX + 10 + 'px';
        tooltip.style.top = e.pageY - 10 + 'px';
        tooltip.classList.add('show');
    }
    
    // 툴팁 숨기기
    hideTooltip() {
        if (this.elements.tooltip) {
            this.elements.tooltip.classList.remove('show');
        }
    }
    
    // 토스트 알림 표시
    showToast(message, type = 'info') {
        if (!this.elements.toast) return;
        
        const toast = this.elements.toast;
        const icon = toast.querySelector('.toast-icon');
        const messageEl = toast.querySelector('.toast-message');
        
        // 아이콘 설정
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        if (icon) icon.textContent = icons[type] || icons.info;
        if (messageEl) messageEl.textContent = message;
        
        // 클래스 설정
        toast.className = `toast ${type}`;
        toast.classList.add('show');
        
        // 기존 타이머 제거
        if (this.toastTimer) {
            clearTimeout(this.toastTimer);
        }
        
        // 5초 후 자동 숨김
        this.toastTimer = setTimeout(() => {
            this.hideToast();
        }, 5000);
    }
    
    // 토스트 알림 숨기기
    hideToast() {
        if (this.elements.toast) {
            this.elements.toast.classList.remove('show');
        }
        if (this.toastTimer) {
            clearTimeout(this.toastTimer);
            this.toastTimer = null;
        }
    }
    
    // 키보드 이벤트 처리
    handleKeydown(e) {
        if (this.elements.deleteModal?.classList.contains('show')) {
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                this.executeDelete();
            } else if (e.code === 'Escape') {
                e.preventDefault();
                this.cancelDelete();
            }
        }
        
        if (this.elements.supabaseModal?.classList.contains('show') && e.code === 'Escape') {
            this.skipSupabaseConnection();
        }
    }
    
    // 모달 표시/숨기기
    showModal(modalId) {
        const modal = this.elements[modalId];
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }
    
    closeModal(modalId) {
        const modal = this.elements[modalId];
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }
    }
    
    // 로딩 상태 표시
    showLoading(elementId, text) {
        const element = this.elements[elementId] || document.getElementById(elementId);
        if (element) {
            element.textContent = text;
            element.disabled = true;
            element.classList.add('loading');
        }
    }
    
    hideLoading(elementId, originalText) {
        const element = this.elements[elementId] || document.getElementById(elementId);
        if (element) {
            element.textContent = originalText;
            element.disabled = false;
            element.classList.remove('loading');
        }
    }
    
    // 소멸자 - 타이머 정리
    destroy() {
        if (this.connectionCheckTimer) {
            clearInterval(this.connectionCheckTimer);
        }
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
        if (this.toastTimer) {
            clearTimeout(this.toastTimer);
        }
    }
}

// 애플리케이션 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.planManager = new ProductionPlanManager();
});

// 페이지 종료 시 정리
window.addEventListener('beforeunload', () => {
    if (window.planManager) {
        window.planManager.destroy();
    }
});