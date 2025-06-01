// 전역 상태 관리
let plans = [];
let currentDate = new Date();
let selectedPlan = null;
let viewMode = 'month'; // 'month' or 'week'

// 공정라인 색상 매핑
const processColors = {
    'PTP1': '#6c63ff',
    'PTP2': '#4CAF50',
    '분말스틱1': '#FF9800',
    '분말스틱2': '#E91E63',
    '분말스틱3': '#9C27B0'
};

// DOM 요소 참조
const elements = {};

// 초기화
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    initializeEventListeners();
    loadSampleData();
    renderCalendar();
    renderPlansList();
    updateSaveStatus('저장됨');
    setDefaultDates();
});

// DOM 요소 초기화
function initializeElements() {
    elements.planForm = document.getElementById('planForm');
    elements.plansList = document.getElementById('plansList');
    elements.calendar = document.getElementById('calendar');
    elements.currentMonth = document.getElementById('currentMonth');
    elements.saveStatus = document.getElementById('saveStatus');
    elements.shareModal = document.getElementById('shareModal');
    elements.deleteModal = document.getElementById('deleteModal');
    elements.tooltip = document.getElementById('tooltip');
    elements.quantityInput = document.getElementById('quantity');
}

// 기본 날짜 설정
function setDefaultDates() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    document.getElementById('startDate').value = today.toISOString().split('T')[0];
    document.getElementById('endDate').value = tomorrow.toISOString().split('T')[0];
}

// 이벤트 리스너 초기화
function initializeEventListeners() {
    // 폼 제출
    if (elements.planForm) {
        elements.planForm.addEventListener('submit', handlePlanSubmit);
    }
    
    // 수주량 입력 포맷팅
    if (elements.quantityInput) {
        elements.quantityInput.addEventListener('input', formatQuantityInput);
    }
    
    // 달력 네비게이션
    const prevBtn = document.getElementById('prevMonth');
    const nextBtn = document.getElementById('nextMonth');
    if (prevBtn) prevBtn.addEventListener('click', () => navigateMonth(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => navigateMonth(1));
    
    // 뷰 모드 변경
    const monthViewBtn = document.getElementById('monthView');
    const weekViewBtn = document.getElementById('weekView');
    if (monthViewBtn) monthViewBtn.addEventListener('click', () => setViewMode('month'));
    if (weekViewBtn) weekViewBtn.addEventListener('click', () => setViewMode('week'));
    
    // 백업/복원
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');
    if (exportBtn) exportBtn.addEventListener('click', exportData);
    if (importBtn) importBtn.addEventListener('click', () => importFile.click());
    if (importFile) importFile.addEventListener('change', importData);
    
    // 공유 가이드 모달
    const shareGuideBtn = document.getElementById('shareGuideBtn');
    const closeModal = document.getElementById('closeModal');
    if (shareGuideBtn) shareGuideBtn.addEventListener('click', () => showModal('shareModal'));
    if (closeModal) closeModal.addEventListener('click', () => hideModal('shareModal'));
    
    // 삭제 확인 모달
    const confirmDelete = document.getElementById('confirmDelete');
    const cancelDelete = document.getElementById('cancelDelete');
    if (confirmDelete) confirmDelete.addEventListener('click', confirmDeletePlan);
    if (cancelDelete) cancelDelete.addEventListener('click', () => hideModal('deleteModal'));
    
    // 키보드 이벤트
    document.addEventListener('keydown', handleKeyboardEvents);
    
    // 모달 외부 클릭
    document.addEventListener('click', handleModalOutsideClick);
    
    // 모바일 메뉴
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) mobileMenu.addEventListener('click', toggleMobileMenu);
}

// 샘플 데이터 로드
function loadSampleData() {
    const samplePlans = [
        {
            id: generateId(),
            customer: "ABC Corp",
            productId: "PRD-001",
            productName: "프로틴 파우더",
            quantity: 50000,
            processLine: "PTP1",
            startDate: "2025-06-05",
            endDate: "2025-06-10"
        },
        {
            id: generateId(),
            customer: "XYZ Ltd",
            productId: "PRD-002",
            productName: "비타민 스틱",
            quantity: 1500000,
            processLine: "분말스틱1",
            startDate: "2025-06-03",
            endDate: "2025-06-07"
        }
    ];
    
    plans = samplePlans;
    saveToLocalStorage();
}

// 계획 등록 처리
function handlePlanSubmit(e) {
    e.preventDefault();
    
    const planData = {
        id: generateId(),
        customer: document.getElementById('customer').value.trim(),
        productId: document.getElementById('productId').value.trim(),
        productName: document.getElementById('productName').value.trim(),
        quantity: parseQuantity(document.getElementById('quantity').value),
        processLine: document.getElementById('processLine').value,
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value
    };
    
    // 유효성 검사
    if (!validatePlanData(planData)) {
        return;
    }
    
    // 계획 추가
    plans.push(planData);
    saveToLocalStorage();
    
    // UI 업데이트
    renderPlansList();
    renderCalendar();
    updateSaveStatus('저장 중...');
    
    // 폼 리셋
    e.target.reset();
    setDefaultDates();
    
    // 저장 완료 상태
    setTimeout(() => updateSaveStatus('저장됨'), 500);
}

// 수주량 입력 포맷팅
function formatQuantityInput(e) {
    let value = e.target.value.replace(/[^\d]/g, ''); // 숫자만 유지
    if (value) {
        // 숫자를 콤마 형식으로 변환
        const number = parseInt(value);
        if (!isNaN(number)) {
            value = number.toLocaleString();
        }
    }
    e.target.value = value;
}

// 수주량 파싱 (콤마 제거 후 숫자로 변환)
function parseQuantity(value) {
    if (!value) return 0;
    return parseInt(value.replace(/[^\d]/g, '')) || 0;
}

// 계획 데이터 유효성 검사
function validatePlanData(data) {
    const required = ['customer', 'productId', 'productName', 'quantity', 'processLine', 'startDate', 'endDate'];
    
    for (const field of required) {
        if (!data[field] || (field === 'quantity' && data[field] <= 0)) {
            alert(`${getFieldLabel(field)} 항목을 올바르게 입력해주세요.`);
            return false;
        }
    }
    
    // 날짜 유효성 검사
    if (new Date(data.startDate) > new Date(data.endDate)) {
        alert('시작일이 완료일보다 늦을 수 없습니다.');
        return false;
    }
    
    return true;
}

// 필드 라벨 반환
function getFieldLabel(field) {
    const labels = {
        customer: '고객사',
        productId: '제조번호',
        productName: '제품명',
        quantity: '수주량',
        processLine: '공정라인',
        startDate: '시작일',
        endDate: '완료일'
    };
    return labels[field] || field;
}

// 계획 목록 렌더링
function renderPlansList() {
    if (!elements.plansList) return;
    
    if (plans.length === 0) {
        elements.plansList.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--color-text-secondary);">
                등록된 계획이 없습니다.
            </div>
        `;
        return;
    }
    
    elements.plansList.innerHTML = plans.map(plan => `
        <div class="plan-item ${selectedPlan?.id === plan.id ? 'selected' : ''}" data-plan-id="${plan.id}">
            <div class="plan-info">
                <div class="plan-detail">
                    <div class="plan-title">${plan.productName}</div>
                    <div class="plan-subtitle">${plan.customer} | ${plan.productId}</div>
                </div>
                <div class="plan-quantity">${plan.quantity.toLocaleString()} EA</div>
                <div class="plan-process process-${plan.processLine}" style="background-color: ${processColors[plan.processLine]}">
                    ${plan.processLine}
                </div>
                <div class="plan-dates">
                    ${formatDateRange(plan.startDate, plan.endDate)}
                </div>
            </div>
            <div class="plan-actions">
                <button class="btn-delete" onclick="deletePlan('${plan.id}')">삭제</button>
            </div>
        </div>
    `).join('');
}

// 달력 렌더링
function renderCalendar() {
    if (!elements.calendar) return;
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // 월 표시 업데이트
    if (elements.currentMonth) {
        elements.currentMonth.textContent = `${year}년 ${month + 1}월`;
    }
    
    // 달력 헤더 생성
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    let calendarHTML = weekdays.map(day => 
        `<div class="calendar-header">${day}</div>`
    ).join('');
    
    // 달력 날짜 생성
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));
    
    const currentCalendarDate = new Date(startDate);
    const today = new Date();
    
    while (currentCalendarDate <= endDate) {
        const dayNumber = currentCalendarDate.getDate();
        const isCurrentMonth = currentCalendarDate.getMonth() === month;
        const isToday = currentCalendarDate.toDateString() === today.toDateString();
        
        const dayPlans = getPlansForDate(currentCalendarDate);
        
        calendarHTML += `
            <div class="calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}">
                <div class="day-number">${dayNumber}</div>
                <div class="day-plans">
                    ${dayPlans.map(plan => `
                        <div class="plan-block process-${plan.processLine}" 
                             style="background-color: ${processColors[plan.processLine]}"
                             onmouseenter="showTooltip(event, '${plan.id}')"
                             onmouseleave="hideTooltip()">
                            ${plan.productName}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        currentCalendarDate.setDate(currentCalendarDate.getDate() + 1);
    }
    
    elements.calendar.innerHTML = calendarHTML;
}

// 특정 날짜의 계획 조회
function getPlansForDate(date) {
    const dateStr = date.toISOString().split('T')[0];
    return plans.filter(plan => {
        return dateStr >= plan.startDate && dateStr <= plan.endDate;
    });
}

// 날짜 범위 포맷팅
function formatDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startStr = `${start.getMonth() + 1}/${start.getDate()}`;
    const endStr = `${end.getMonth() + 1}/${end.getDate()}`;
    return `${startStr} ~ ${endStr}`;
}

// 월 네비게이션
function navigateMonth(direction) {
    currentDate.setMonth(currentDate.getMonth() + direction);
    renderCalendar();
}

// 뷰 모드 설정
function setViewMode(mode) {
    viewMode = mode;
    
    // 버튼 상태 업데이트
    const monthViewBtn = document.getElementById('monthView');
    const weekViewBtn = document.getElementById('weekView');
    
    if (monthViewBtn) {
        monthViewBtn.className = mode === 'month' ? 'btn btn--secondary btn--sm' : 'btn btn--outline btn--sm';
    }
    if (weekViewBtn) {
        weekViewBtn.className = mode === 'week' ? 'btn btn--secondary btn--sm' : 'btn btn--outline btn--sm';
    }
    
    // 달력 클래스 업데이트
    if (elements.calendar) {
        elements.calendar.className = mode === 'week' ? 'calendar week-view' : 'calendar';
    }
    
    renderCalendar();
}

// 계획 삭제
function deletePlan(planId) {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    
    selectedPlan = plan;
    
    // 삭제 정보 표시
    const deleteInfo = document.getElementById('deleteInfo');
    if (deleteInfo) {
        deleteInfo.innerHTML = `
            <strong>${plan.productName}</strong><br>
            고객사: ${plan.customer}<br>
            수주량: ${plan.quantity.toLocaleString()} EA<br>
            공정라인: ${plan.processLine}
        `;
    }
    
    showModal('deleteModal');
}

// 삭제 확인
function confirmDeletePlan() {
    if (!selectedPlan) return;
    
    plans = plans.filter(p => p.id !== selectedPlan.id);
    selectedPlan = null;
    
    saveToLocalStorage();
    renderPlansList();
    renderCalendar();
    updateSaveStatus('저장 중...');
    
    hideModal('deleteModal');
    
    setTimeout(() => updateSaveStatus('저장됨'), 500);
}

// 툴팁 표시
function showTooltip(event, planId) {
    const plan = plans.find(p => p.id === planId);
    if (!plan || !elements.tooltip) return;
    
    const tooltipContent = `
        <strong>${plan.productName}</strong><br>
        고객사: ${plan.customer}<br>
        제조번호: ${plan.productId}<br>
        수주량: ${plan.quantity.toLocaleString()} EA<br>
        공정라인: ${plan.processLine}<br>
        기간: ${formatDateRange(plan.startDate, plan.endDate)}
    `;
    
    elements.tooltip.innerHTML = tooltipContent;
    elements.tooltip.className = 'tooltip show';
    
    // 툴팁 위치 설정
    const rect = event.target.getBoundingClientRect();
    elements.tooltip.style.left = (rect.left + rect.width / 2) + 'px';
    elements.tooltip.style.top = (rect.top - 10) + 'px';
    elements.tooltip.style.transform = 'translateX(-50%) translateY(-100%)';
}

// 툴팁 숨기기
function hideTooltip() {
    if (elements.tooltip) {
        elements.tooltip.className = 'tooltip';
    }
}

// 모달 표시
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

// 모달 숨기기
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// 키보드 이벤트 처리
function handleKeyboardEvents(e) {
    // 삭제 모달이 열려있을 때
    if (elements.deleteModal && elements.deleteModal.classList.contains('active')) {
        if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            confirmDeletePlan();
        } else if (e.code === 'Escape') {
            e.preventDefault();
            hideModal('deleteModal');
        }
    }
    
    // 모달이 열려있을 때 ESC로 닫기
    if (e.code === 'Escape') {
        if (elements.shareModal && elements.shareModal.classList.contains('active')) {
            hideModal('shareModal');
        }
    }
}

// 모달 외부 클릭 처리
function handleModalOutsideClick(e) {
    if (e.target.classList.contains('modal')) {
        if (e.target.id === 'shareModal') {
            hideModal('shareModal');
        } else if (e.target.id === 'deleteModal') {
            hideModal('deleteModal');
        }
    }
}

// 데이터 내보내기
function exportData() {
    const dataToExport = {
        plans: plans,
        exportDate: new Date().toISOString(),
        version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
        type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `생산계획_백업_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    updateSaveStatus('백업 완료');
    setTimeout(() => updateSaveStatus('저장됨'), 2000);
}

// 데이터 가져오기
function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const importedData = JSON.parse(event.target.result);
            
            if (importedData.plans && Array.isArray(importedData.plans)) {
                // 기존 데이터에 병합할지 확인
                const merge = confirm('기존 데이터와 병합하시겠습니까? (취소하면 기존 데이터를 대체합니다)');
                
                if (merge) {
                    // ID 중복 방지
                    const newPlans = importedData.plans.map(plan => ({
                        ...plan,
                        id: generateId()
                    }));
                    plans = [...plans, ...newPlans];
                } else {
                    plans = importedData.plans.map(plan => ({
                        ...plan,
                        id: plan.id || generateId()
                    }));
                }
                
                saveToLocalStorage();
                renderPlansList();
                renderCalendar();
                updateSaveStatus('복원 완료');
                
                setTimeout(() => updateSaveStatus('저장됨'), 2000);
            } else {
                alert('올바른 백업 파일이 아닙니다.');
            }
        } catch (error) {
            alert('파일을 읽는 중 오류가 발생했습니다.');
            console.error('Import error:', error);
        }
    };
    
    reader.readAsText(file);
    e.target.value = ''; // 파일 입력 리셋
}

// localStorage에 저장
function saveToLocalStorage() {
    try {
        localStorage.setItem('production_plans', JSON.stringify(plans));
    } catch (error) {
        console.error('저장 실패:', error);
    }
}

// localStorage에서 로드
function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem('production_plans');
        if (saved) {
            plans = JSON.parse(saved);
            return true;
        }
    } catch (error) {
        console.error('로드 실패:', error);
    }
    return false;
}

// 저장 상태 업데이트
function updateSaveStatus(status) {
    if (!elements.saveStatus) return;
    
    elements.saveStatus.textContent = status;
    elements.saveStatus.className = 'save-status';
    
    if (status.includes('저장 중') || status.includes('복원') || status.includes('백업')) {
        elements.saveStatus.classList.add('saving');
    }
}

// 모바일 메뉴 토글
function toggleMobileMenu() {
    alert('모바일 메뉴: 공유 가이드와 백업 기능을 이용해보세요!');
}

// 유틸리티 함수들
function generateId() {
    return 'plan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 날짜 유틸리티
function isDateInRange(date, startDate, endDate) {
    const d = new Date(date);
    const start = new Date(startDate);
    const end = new Date(endDate);
    return d >= start && d <= end;
}

// 반응형 처리
function handleResize() {
    // 모바일에서 달력 최적화
    if (window.innerWidth <= 768 && elements.calendar) {
        elements.calendar.classList.add('mobile-view');
    } else if (elements.calendar) {
        elements.calendar.classList.remove('mobile-view');
    }
}

// 리사이즈 이벤트 리스너
window.addEventListener('resize', handleResize);

// 초기 리사이즈 체크
window.addEventListener('load', handleResize);

// 전역 함수로 노출 (HTML에서 사용)
window.deletePlan = deletePlan;
window.showTooltip = showTooltip;
window.hideTooltip = hideTooltip;