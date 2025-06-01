// 생산계획 관리 시스템 - 메인 JavaScript
class ProductionPlanManager {
    constructor() {
        // 초기 데이터 설정
        this.plans = [];
        
        // 현재 날짜 기준으로 월 설정
        const today = new Date();
        this.currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        // GitHub 설정
        this.githubConfig = {
            user: "healthyon",
            repo: "mes",
            token: null,
            dataPath: "data.json",
            sha: null
        };
        
        // 공정라인 색상 매핑
        this.processColors = {
            'PTP1': '#6c63ff',
            'PTP2': '#4CAF50',
            '분말스틱1': '#FF9800',
            '분말스틱2': '#E91E63',
            '분말스틱3': '#9C27B0'
        };
        
        // 삭제할 계획 ID 저장
        this.planToDelete = null;
        
        // 자동 저장 타이머
        this.autoSaveTimer = null;
        
        // DOM 요소 참조
        this.elements = {};
        
        // 초기화
        this.initialize();
    }
    
    // 애플리케이션 초기화
    async initialize() {
        // DOM 요소 초기화
        this.initializeElements();
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        // 로컬 스토리지에서 설정 불러오기
        this.loadConfigFromLocalStorage();
        
        // 샘플 데이터 로드
        this.loadSampleData();
        
        // GitHub 설정 모달 표시 (GitHub 토큰이 없는 경우)
        if (!this.githubConfig.token) {
            this.showModal('githubModal');
        } else {
            // GitHub에서 데이터 로드
            await this.loadFromGithub();
        }
        
        // UI 업데이트
        this.updateCalendar();
        this.updatePlansList();
        this.updateConnectionStatus();
        
        // 시작일/완료일 기본값 설정
        const today = new Date();
        const todayStr = this.formatDateForInput(today);
        this.elements.startDate.value = todayStr;
        
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        const nextWeekStr = this.formatDateForInput(nextWeek);
        this.elements.endDate.value = nextWeekStr;
    }
    
    // DOM 요소 초기화
    initializeElements() {
        const elementIds = [
            'githubModal', 'deleteModal', 'githubToken', 'githubRepo', 
            'connectGithub', 'skipGithub', 'confirmDelete', 'cancelDelete', 
            'deleteMessage', 'connectionStatus', 'planForm', 'customer', 
            'productId', 'productName', 'quantity', 'processLine', 
            'startDate', 'endDate', 'submitText', 'calendar', 'currentMonth', 
            'prevMonth', 'nextMonth', 'plansList', 'planCount', 'tooltip',
            'saveNotification', 'saveMessage'
        ];
        
        elementIds.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });
    }
    
    // 이벤트 리스너 설정
    setupEventListeners() {
        // GitHub 연결 관련
        this.elements.connectGithub.addEventListener('click', () => this.connectToGithub());
        this.elements.skipGithub.addEventListener('click', () => this.skipGithubSetup());
        
        // 삭제 확인 관련
        this.elements.confirmDelete.addEventListener('click', () => this.executeDelete());
        this.elements.cancelDelete.addEventListener('click', () => this.cancelDelete());
        
        // 폼 제출
        this.elements.planForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        
        // 수주량 포맷팅
        this.elements.quantity.addEventListener('input', (e) => this.formatQuantity(e));
        
        // 달력 네비게이션
        this.elements.prevMonth.addEventListener('click', () => this.changeMonth(-1));
        this.elements.nextMonth.addEventListener('click', () => this.changeMonth(1));
        
        // 키보드 이벤트 (삭제 확인용)
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
        
        // 모달 외부 클릭시 닫기
        this.elements.githubModal.addEventListener('click', (e) => {
            if (e.target === this.elements.githubModal) {
                this.skipGithubSetup();
            }
        });
        
        this.elements.deleteModal.addEventListener('click', (e) => {
            if (e.target === this.elements.deleteModal) {
                this.cancelDelete();
            }
        });
        
        // 날짜 유효성 검사
        this.elements.startDate.addEventListener('change', () => this.validateDates());
        this.elements.endDate.addEventListener('change', () => this.validateDates());
    }
    
    // 날짜 유효성 검사
    validateDates() {
        const startDate = new Date(this.elements.startDate.value);
        const endDate = new Date(this.elements.endDate.value);
        
        if (startDate > endDate) {
            alert('시작일은 완료일보다 빨라야 합니다.');
            this.elements.endDate.value = this.elements.startDate.value;
        }
    }
    
    // 날짜 형식 변환 (input type="date"용)
    formatDateForInput(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // 샘플 데이터 로드
    loadSampleData() {
        // 샘플 데이터가 없는 경우에만 로드
        if (this.plans.length === 0) {
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
        }
    }
    
    // 로컬 스토리지에서 설정 불러오기
    loadConfigFromLocalStorage() {
        const storedToken = localStorage.getItem('githubToken');
        if (storedToken) {
            this.githubConfig.token = storedToken;
        }
        
        const storedPlans = localStorage.getItem('plans');
        if (storedPlans) {
            try {
                this.plans = JSON.parse(storedPlans);
            } catch (error) {
                console.error('로컬 스토리지 데이터 파싱 오류:', error);
            }
        }
    }
    
    // 로컬 스토리지에 설정 저장
    saveConfigToLocalStorage() {
        if (this.githubConfig.token) {
            localStorage.setItem('githubToken', this.githubConfig.token);
        }
        
        localStorage.setItem('plans', JSON.stringify(this.plans));
    }
    
    // GitHub 연결
    async connectToGithub() {
        const token = this.elements.githubToken.value.trim();
        
        if (!token) {
            alert('GitHub Personal Access Token을 입력해주세요.');
            return;
        }
        
        this.githubConfig.token = token;
        
        try {
            this.showLoading('connectGithub', '연결 중...');
            
            // GitHub API 테스트
            const response = await fetch(`https://api.github.com/repos/${this.githubConfig.user}/${this.githubConfig.repo}`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (!response.ok) {
                throw new Error('저장소에 접근할 수 없습니다. 토큰을 확인해주세요.');
            }
            
            // 설정 저장
            this.saveConfigToLocalStorage();
            
            // 기존 데이터 로드 시도
            await this.loadFromGithub();
            
            this.closeModal('githubModal');
            this.updateConnectionStatus();
            this.showSaveNotification('GitHub 저장소에 연결되었습니다');
            
            // 자동 저장 타이머 설정
            this.setupAutoSaveTimer();
            
        } catch (error) {
            console.error('GitHub 연결 오류:', error);
            alert(`연결 실패: ${error.message}`);
            this.githubConfig.token = null;
        } finally {
            this.hideLoading('connectGithub', '연결');
        }
    }
    
    // 자동 저장 타이머 설정
    setupAutoSaveTimer() {
        // 기존 타이머 제거
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
        
        // 5분마다 자동 저장
        this.autoSaveTimer = setInterval(() => {
            if (this.githubConfig.token) {
                this.saveToGithub(true);
            }
        }, 5 * 60 * 1000);
    }
    
    // GitHub 설정 건너뛰기
    skipGithubSetup() {
        this.closeModal('githubModal');
        this.updateConnectionStatus();
    }
    
    // GitHub에서 데이터 로드
    async loadFromGithub() {
        if (!this.githubConfig.token) return;
        
        try {
            this.showSaveNotification('GitHub에서 데이터 불러오는 중...');
            
            const response = await fetch(`https://api.github.com/repos/${this.githubConfig.user}/${this.githubConfig.repo}/contents/${this.githubConfig.dataPath}`, {
                headers: {
                    'Authorization': `token ${this.githubConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.githubConfig.sha = data.sha;
                
                // Base64 디코딩하여 JSON 파싱
                const content = JSON.parse(atob(data.content.replace(/\s/g, '')));
                if (content.plans && Array.isArray(content.plans)) {
                    this.plans = content.plans;
                    
                    // 로컬 스토리지에 백업
                    this.saveConfigToLocalStorage();
                    
                    // UI 업데이트
                    this.updateCalendar();
                    this.updatePlansList();
                    
                    this.showSaveNotification('데이터를 성공적으로 불러왔습니다', 2000);
                }
            } else if (response.status === 404) {
                // 파일이 없으면 초기 데이터로 새로 생성
                this.showSaveNotification('새 데이터 파일 생성 중...');
                await this.saveToGithub();
            } else {
                throw new Error(`GitHub API 오류: ${response.status}`);
            }
        } catch (error) {
            console.error('GitHub 데이터 로드 오류:', error);
            this.showSaveNotification('데이터 로드 실패, 로컬 데이터 사용 중', 3000);
        }
    }
    
    // GitHub에 데이터 저장
    async saveToGithub(isAutoSave = false) {
        if (!this.githubConfig.token) return;
        
        try {
            if (!isAutoSave) {
                this.showSaveNotification('GitHub에 저장 중...');
            } else {
                this.showSaveNotification('자동 저장 중...');
            }
            
            const data = {
                plans: this.plans,
                lastUpdated: new Date().toISOString()
            };
            
            const content = btoa(JSON.stringify(data, null, 2));
            
            const payload = {
                message: '생산계획 데이터 업데이트',
                content: content
            };
            
            // SHA가 있으면 업데이트, 없으면 새로 생성
            if (this.githubConfig.sha) {
                payload.sha = this.githubConfig.sha;
            }
            
            const response = await fetch(`https://api.github.com/repos/${this.githubConfig.user}/${this.githubConfig.repo}/contents/${this.githubConfig.dataPath}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.githubConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                const result = await response.json();
                this.githubConfig.sha = result.content.sha;
                
                if (!isAutoSave) {
                    this.showSaveNotification('저장 완료', 2000);
                } else {
                    this.showSaveNotification('자동 저장 완료', 2000);
                }
                
                // 로컬 스토리지에 백업
                this.saveConfigToLocalStorage();
            } else {
                throw new Error(`GitHub API 오류: ${response.status}`);
            }
        } catch (error) {
            console.error('GitHub 저장 오류:', error);
            this.showSaveNotification('저장 실패, 다시 시도합니다', 3000);
        }
    }
    
    // 폼 제출 처리
    async handleFormSubmit(e) {
        e.preventDefault();
        
        const formData = {
            id: 'plan_' + Date.now(),
            customer: this.elements.customer.value.trim(),
            productId: this.elements.productId.value.trim(),
            productName: this.elements.productName.value.trim(),
            quantity: parseInt(this.elements.quantity.value.replace(/,/g, '')),
            processLine: this.elements.processLine.value,
            startDate: this.elements.startDate.value,
            endDate: this.elements.endDate.value,
            createdAt: new Date().toISOString()
        };
        
        // 유효성 검사
        if (!this.validateForm(formData)) return;
        
        try {
            this.showLoading('submitText', '저장 중...');
            
            // 계획 추가
            this.plans.push(formData);
            
            // GitHub에 저장
            if (this.githubConfig.token) {
                await this.saveToGithub();
            } else {
                // 로컬 스토리지에만 저장
                this.saveConfigToLocalStorage();
                this.showSaveNotification('로컬에 저장 완료', 2000);
            }
            
            // UI 업데이트
            this.updateCalendar();
            this.updatePlansList();
            
            // 폼 초기화 (날짜 제외)
            const startDate = this.elements.startDate.value;
            const endDate = this.elements.endDate.value;
            
            this.elements.planForm.reset();
            
            this.elements.startDate.value = startDate;
            this.elements.endDate.value = endDate;
            
            alert('생산계획이 성공적으로 등록되었습니다! 🎉');
            
        } catch (error) {
            console.error('계획 저장 오류:', error);
            alert('저장 중 오류가 발생했습니다. 다시 시도해주세요.');
        } finally {
            this.hideLoading('submitText', '📋 계획 등록');
        }
    }
    
    // 폼 유효성 검사
    validateForm(data) {
        if (!data.customer || !data.productId || !data.productName || 
            !data.quantity || !data.processLine || !data.startDate || !data.endDate) {
            alert('모든 필드를 입력해주세요.');
            return false;
        }
        
        if (isNaN(data.quantity) || data.quantity <= 0) {
            alert('수주량은 0보다 큰 숫자를 입력해주세요.');
            return false;
        }
        
        if (new Date(data.startDate) > new Date(data.endDate)) {
            alert('시작일은 완료일보다 빨라야 합니다.');
            return false;
        }
        
        return true;
    }
    
    // 수주량 천단위 콤마 포맷팅
    formatQuantity(e) {
        let value = e.target.value.replace(/,/g, '');
        if (value && !isNaN(value)) {
            e.target.value = parseInt(value).toLocaleString();
        }
    }
    
    // 달력 업데이트
    updateCalendar() {
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        
        // 월 제목 업데이트
        this.elements.currentMonth.textContent = `${year}년 ${month + 1}월`;
        
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
            
            // 다른 달인지 확인
            if (currentDate.getMonth() !== month) {
                cell.classList.add('other-month');
            }
            
            // 오늘인지 확인
            if (currentDate.toDateString() === today.toDateString()) {
                cell.classList.add('today');
            }
            
            // 날짜 표시
            const dateDiv = document.createElement('div');
            dateDiv.className = 'calendar-date';
            dateDiv.textContent = currentDate.getDate();
            cell.appendChild(dateDiv);
            
            // 해당 날짜의 계획 표시
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
        const dateString = this.formatDateForInput(date);
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
        
        // 시작일 기준으로 정렬
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
                    <span class="plan-detail-value">${plan.quantity.toLocaleString()} EA</span>
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
            
            // 계획 삭제
            this.plans = this.plans.filter(plan => plan.id !== this.planToDelete);
            
            // GitHub에 저장
            if (this.githubConfig.token) {
                await this.saveToGithub();
            } else {
                // 로컬 스토리지에만 저장
                this.saveConfigToLocalStorage();
                this.showSaveNotification('로컬에 변경사항 저장 완료', 2000);
            }
            
            // UI 업데이트
            this.updateCalendar();
            this.updatePlansList();
            
            this.closeModal('deleteModal');
            this.planToDelete = null;
            
            alert('생산계획이 삭제되었습니다.');
            
        } catch (error) {
            console.error('삭제 오류:', error);
            alert('삭제 중 오류가 발생했습니다.');
        } finally {
            this.hideLoading('confirmDelete', '삭제');
        }
    }
    
    // 삭제 취소
    cancelDelete() {
        this.closeModal('deleteModal');
        this.planToDelete = null;
    }
    
    // 키보드 이벤트 처리
    handleKeydown(e) {
        // 삭제 확인 모달이 열려있을 때만
        if (this.elements.deleteModal.classList.contains('show')) {
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                this.executeDelete();
            } else if (e.code === 'Escape') {
                e.preventDefault();
                this.cancelDelete();
            }
        }
        
        // GitHub 모달에서 ESC 처리
        if (this.elements.githubModal.classList.contains('show') && e.code === 'Escape') {
            this.skipGithubSetup();
        }
    }
    
    // 툴팁 표시
    showTooltip(e, plan) {
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
                <span>${plan.quantity.toLocaleString()} EA</span>
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
        this.elements.tooltip.classList.remove('show');
    }
    
    // 모달 표시/숨기기
    showModal(modalId) {
        this.elements[modalId].classList.add('show');
        document.body.style.overflow = 'hidden';
    }
    
    closeModal(modalId) {
        this.elements[modalId].classList.remove('show');
        document.body.style.overflow = '';
    }
    
    // 로딩 상태 표시
    showLoading(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
            element.disabled = true;
            element.classList.add('loading');
        }
    }
    
    hideLoading(elementId, originalText) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = originalText;
            element.disabled = false;
            element.classList.remove('loading');
        }
    }
    
    // 저장 알림 표시
    showSaveNotification(message, duration = 0) {
        const notification = this.elements.saveNotification;
        const messageElement = this.elements.saveMessage;
        
        messageElement.textContent = message;
        notification.classList.add('show');
        
        if (duration > 0) {
            setTimeout(() => {
                notification.classList.remove('show');
            }, duration);
        }
    }
    
    // 연결 상태 업데이트
    updateConnectionStatus() {
        const status = this.elements.connectionStatus.querySelector('.status');
        
        if (this.githubConfig.token) {
            status.className = 'status status--success';
            status.textContent = `연결 상태: GitHub 연동 중 (${this.githubConfig.user}/${this.githubConfig.repo})`;
        } else {
            status.className = 'status status--warning';
            status.textContent = '연결 상태: 로컬 모드 (GitHub 연결 안됨)';
        }
    }
}

// 애플리케이션 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.planManager = new ProductionPlanManager();
});