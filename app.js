// 생산계획 관리 시스템 - 메인 JavaScript
class ProductionPlanManager {
    constructor() {
        // 초기 데이터 설정
        this.plans = [];
        this.currentMonth = new Date(2025, 5, 1); // 2025년 6월
        this.githubConfig = {
            token: null,
            repo: null,
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
        
        // DOM 요소 참조
        this.initializeElements();
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        // 초기화
        this.initialize();
    }
    
    // DOM 요소 초기화
    initializeElements() {
        this.elements = {
            // 모달 관련
            githubModal: document.getElementById('githubModal'),
            deleteModal: document.getElementById('deleteModal'),
            githubToken: document.getElementById('githubToken'),
            githubRepo: document.getElementById('githubRepo'),
            connectGithub: document.getElementById('connectGithub'),
            skipGithub: document.getElementById('skipGithub'),
            confirmDelete: document.getElementById('confirmDelete'),
            cancelDelete: document.getElementById('cancelDelete'),
            deleteMessage: document.getElementById('deleteMessage'),
            
            // 상태 표시
            connectionStatus: document.getElementById('connectionStatus'),
            
            // 폼 관련
            planForm: document.getElementById('planForm'),
            customer: document.getElementById('customer'),
            productId: document.getElementById('productId'),
            productName: document.getElementById('productName'),
            quantity: document.getElementById('quantity'),
            processLine: document.getElementById('processLine'),
            startDate: document.getElementById('startDate'),
            endDate: document.getElementById('endDate'),
            submitText: document.getElementById('submitText'),
            
            // 달력 관련
            calendar: document.getElementById('calendar'),
            currentMonth: document.getElementById('currentMonth'),
            prevMonth: document.getElementById('prevMonth'),
            nextMonth: document.getElementById('nextMonth'),
            
            // 계획 목록
            plansList: document.getElementById('plansList'),
            planCount: document.getElementById('planCount'),
            
            // 툴팁
            tooltip: document.getElementById('tooltip')
        };
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
                this.closeModal('githubModal');
            }
        });
        
        this.elements.deleteModal.addEventListener('click', (e) => {
            if (e.target === this.elements.deleteModal) {
                this.cancelDelete();
            }
        });
    }
    
    // 애플리케이션 초기화
    async initialize() {
        // 샘플 데이터 로드
        this.loadSampleData();
        
        // 저장된 GitHub 설정 확인
        const savedConfig = this.loadGithubConfig();
        if (savedConfig.token && savedConfig.repo) {
            this.githubConfig = savedConfig;
            await this.loadFromGithub();
        } else {
            this.showModal('githubModal');
        }
        
        // UI 업데이트
        this.updateCalendar();
        this.updatePlansList();
        this.updateConnectionStatus();
    }
    
    // 샘플 데이터 로드
    loadSampleData() {
        const samplePlans = [
            {
                id: 'plan_001',
                customer: 'ABC Corporation',
                productId: 'PRD-2025-001',
                productName: '프로틴 파우더 A타입',
                quantity: 500000,
                processLine: 'PTP1',
                startDate: '2025-06-05',
                endDate: '2025-06-10'
            },
            {
                id: 'plan_002',
                customer: 'XYZ Limited',
                productId: 'PRD-2025-002',
                productName: '비타민 스틱 B타입',
                quantity: 1500000,
                processLine: '분말스틱1',
                startDate: '2025-06-03',
                endDate: '2025-06-07'
            }
        ];
        
        // 기존 데이터가 없으면 샘플 데이터 사용
        if (this.plans.length === 0) {
            this.plans = samplePlans;
        }
    }
    
    // GitHub 설정 저장/로드 (localStorage 사용)
    saveGithubConfig() {
        localStorage.setItem('productionPlan_githubConfig', JSON.stringify(this.githubConfig));
    }
    
    loadGithubConfig() {
        const saved = localStorage.getItem('productionPlan_githubConfig');
        return saved ? JSON.parse(saved) : { token: null, repo: null, sha: null };
    }
    
    // GitHub 연결
    async connectToGithub() {
        const token = this.elements.githubToken.value.trim();
        const repo = this.elements.githubRepo.value.trim();
        
        if (!token || !repo) {
            alert('토큰과 저장소를 모두 입력해주세요.');
            return;
        }
        
        this.githubConfig.token = token;
        this.githubConfig.repo = repo;
        
        try {
            this.showLoading('connectGithub', '연결 중...');
            
            // GitHub API 테스트
            const response = await fetch(`https://api.github.com/repos/${repo}`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (!response.ok) {
                throw new Error('저장소에 접근할 수 없습니다. 토큰과 저장소 경로를 확인해주세요.');
            }
            
            // 설정 저장
            this.saveGithubConfig();
            
            // 기존 데이터 로드
            await this.loadFromGithub();
            
            this.closeModal('githubModal');
            this.updateConnectionStatus();
            
            alert('GitHub 저장소에 성공적으로 연결되었습니다! 🎉');
            
        } catch (error) {
            console.error('GitHub 연결 오류:', error);
            alert(`연결 실패: ${error.message}`);
        } finally {
            this.hideLoading('connectGithub', '연결');
        }
    }
    
    // GitHub 설정 건너뛰기
    skipGithubSetup() {
        this.closeModal('githubModal');
        this.updateConnectionStatus();
    }
    
    // GitHub에서 데이터 로드
    async loadFromGithub() {
        if (!this.githubConfig.token || !this.githubConfig.repo) return;
        
        try {
            const response = await fetch(`https://api.github.com/repos/${this.githubConfig.repo}/contents/data.json`, {
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
                this.plans = content.plans || [];
                
                this.updateCalendar();
                this.updatePlansList();
                
                console.log('GitHub에서 데이터를 성공적으로 로드했습니다.');
            } else if (response.status === 404) {
                // 파일이 없으면 초기 데이터로 새로 생성
                await this.saveToGithub();
            }
        } catch (error) {
            console.error('GitHub 데이터 로드 오류:', error);
        }
    }
    
    // GitHub에 데이터 저장
    async saveToGithub() {
        if (!this.githubConfig.token || !this.githubConfig.repo) return;
        
        try {
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
            
            const response = await fetch(`https://api.github.com/repos/${this.githubConfig.repo}/contents/data.json`, {
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
                this.saveGithubConfig();
                console.log('GitHub에 데이터를 성공적으로 저장했습니다.');
            }
        } catch (error) {
            console.error('GitHub 저장 오류:', error);
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
            endDate: this.elements.endDate.value
        };
        
        // 유효성 검사
        if (!this.validateForm(formData)) return;
        
        try {
            this.showLoading('submitText', '저장 중...');
            
            // 계획 추가
            this.plans.push(formData);
            
            // GitHub에 저장
            await this.saveToGithub();
            
            // UI 업데이트
            this.updateCalendar();
            this.updatePlansList();
            
            // 폼 초기화
            this.elements.planForm.reset();
            
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
        
        if (data.quantity <= 0) {
            alert('수주량은 0보다 큰 값을 입력해주세요.');
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
                <button class="btn btn--error btn--sm" onclick="planManager.confirmDeletePlan('${plan.id}')">
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
            await this.saveToGithub();
            
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
        element.textContent = text;
        element.disabled = true;
        element.classList.add('loading');
    }
    
    hideLoading(elementId, originalText) {
        const element = document.getElementById(elementId);
        element.textContent = originalText;
        element.disabled = false;
        element.classList.remove('loading');
    }
    
    // 연결 상태 업데이트
    updateConnectionStatus() {
        const status = this.elements.connectionStatus.querySelector('.status');
        
        if (this.githubConfig.token && this.githubConfig.repo) {
            status.className = 'status status--success';
            status.textContent = '연결 상태: GitHub 연동 중';
        } else {
            status.className = 'status status--warning';
            status.textContent = '연결 상태: 로컬 모드';
        }
    }
}

// 애플리케이션 초기화
let planManager;

document.addEventListener('DOMContentLoaded', () => {
    planManager = new ProductionPlanManager();
});

// 전역 함수 (HTML에서 호출용)
window.planManager = planManager;