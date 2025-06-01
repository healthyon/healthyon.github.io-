// 전역 변수
let supabaseClient = null;
let githubConfig = {
    token: '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',
    repo: 'healthyon/mes',
    owner: 'healthyon',
    repo_name: 'mes'
};
let productionPlans = [];
let currentWeek = new Date();
let isConnected = { github: false, supabase: false };
let autoSaveInterval = null;

// DOM 요소
const elements = {};

// 애플리케이션 초기화
document.addEventListener('DOMContentLoaded', function() {
    // DOM 요소 초기화
    initializeElements();
    
    // 초기화
    initializeApp();
    setupEventListeners();
    setupKeyboardShortcuts();
    
    // 기본값 설정
    elements.supabaseUrl.value = 'https://kyspwjebzbozuzhgngxm.supabase.co';
    elements.supabaseKey.value = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5c3B3amViemJvenV6aGduZ3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3MTk0MTUsImV4cCI6MjA2NDI5NTQxNX0.10iosLA08Q__Y7E6aJgtOWt5_AEYS783kHxSSXsf9Po';
    elements.githubRepo.value = 'healthyon/mes';
    elements.githubToken.value = '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';
    
    // 수정됨: 자동으로 연결 시도
    setTimeout(connectToServices, 1000);
});

// DOM 요소 초기화
function initializeElements() {
    const ids = [
        'connectionModal', 'mainApp', 'githubToken', 'githubRepo', 
        'supabaseUrl', 'supabaseKey', 'connectButton', 'skipConnection',
        'githubStatus', 'supabaseStatus', 'planForm', 'ganttChart', 
        'planningTableBody', 'toast', 'toastMessage', 'saveStatus',
        'saveStatusText', 'tooltip', 'planCount', 'currentWeek',
        'prevWeek', 'nextWeek', 'connectionIndicator', 'saveButton'
    ];
    
    ids.forEach(id => {
        elements[id] = document.getElementById(id);
    });
}

// 앱 초기화
function initializeApp() {
    // 연결 모달 표시
    elements.connectionModal.style.display = 'flex';
    elements.mainApp.classList.add('hidden');
    
    // 현재 주 표시 업데이트
    updateCurrentWeekDisplay();
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 연결 버튼 클릭
    elements.connectButton.addEventListener('click', connectToServices);
    
    // 건너뛰기 버튼 클릭
    elements.skipConnection.addEventListener('click', function() {
        closeModal();
        showToast('연결 없이 로컬 모드로 시작합니다', 'info');
    });
    
    // 계획 폼 제출
    elements.planForm.addEventListener('submit', function(e) {
        e.preventDefault();
        addProductionPlan();
    });
    
    // 수주량 입력 시 천 단위 콤마 추가
    document.getElementById('quantity').addEventListener('input', function(e) {
        const value = e.target.value.replace(/,/g, '');
        if (value && !isNaN(value)) {
            e.target.value = Number(value).toLocaleString('ko-KR');
        }
    });
    
    // 이전/다음 주 버튼 클릭
    elements.prevWeek.addEventListener('click', function() {
        changeWeek(-1);
    });
    
    elements.nextWeek.addEventListener('click', function() {
        changeWeek(1);
    });
    
    // 저장 버튼 클릭
    elements.saveButton.addEventListener('click', function() {
        saveData();
    });
}

// 키보드 단축키 설정
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // ESC 키로 모달 닫기
        if (e.key === 'Escape') {
            closeAllModals();
        }
        
        // Ctrl+S로 저장
        if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            saveData();
        }
    });
}

// 연결 설정
async function connectToServices() {
    // 애니메이션 상태 설정
    elements.connectButton.classList.add('loading');
    elements.connectButton.textContent = '연결 중...';
    elements.githubStatus.textContent = '연결 중...';
    elements.githubStatus.className = 'status--info';
    elements.supabaseStatus.textContent = '연결 중...';
    elements.supabaseStatus.className = 'status--info';
    
    // 설정값 가져오기
    const githubToken = elements.githubToken.value.trim();
    const githubRepo = elements.githubRepo.value.trim();
    const supabaseUrl = elements.supabaseUrl.value.trim();
    const supabaseKey = elements.supabaseKey.value.trim();
    
    // 값 검증
    if (!githubRepo || !supabaseUrl || !supabaseKey) {
        showToast('모든 필드를 입력해주세요', 'error');
        resetConnectButton();
        return;
    }
    
    // GitHub 저장소 분리
    const [owner, repo] = githubRepo.split('/');
    
    // 설정 저장
    githubConfig = {
        token: githubToken,
        repo: githubRepo,
        owner: owner,
        repo_name: repo
    };
    
    // Supabase 클라이언트 초기화
    try {
        supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
        
        // 수정됨: RLS 오류를 방지하기 위해 익명 인증
        const { data, error } = await supabaseClient.auth.signInAnonymously();
        
        if (error) {
            throw error;
        }
        
        // Supabase 테이블 존재 여부 확인
        await checkSupabaseTable();
        
        isConnected.supabase = true;
        elements.supabaseStatus.textContent = '연결됨';
        elements.supabaseStatus.className = 'status--success';
    } catch (error) {
        console.error('Supabase 연결 오류:', error);
        elements.supabaseStatus.textContent = '연결 실패';
        elements.supabaseStatus.className = 'status--error';
        showToast('Supabase 연결 실패: ' + error.message, 'error');
    }
    
    // GitHub 연결 확인
    try {
        const response = await fetch(`https://api.github.com/repos/${githubRepo}`, {
            headers: {
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                // 수정됨: CORS 우회를 위한 추가 헤더
                'Origin': window.location.origin
            },
            // 수정됨: CORS 오류 방지를 위한 모드 설정
            mode: 'cors'
        });
        
        if (!response.ok) {
            throw new Error(`GitHub API 오류: ${response.status}`);
        }
        
        isConnected.github = true;
        elements.githubStatus.textContent = '연결됨';
        elements.githubStatus.className = 'status--success';
        
        // 데이터 로드
        await loadData();
    } catch (error) {
        console.error('GitHub 연결 오류:', error);
        elements.githubStatus.textContent = '연결 실패';
        elements.githubStatus.className = 'status--error';
        showToast('GitHub 연결 실패: ' + error.message, 'error');
    }
    
    // 자동 저장 설정
    setupAutoSave();
    
    // 연결 완료 처리
    if (isConnected.supabase || isConnected.github) {
        showToast('연결이 완료되었습니다', 'success');
        closeModal();
        updateConnectionIndicator();
    } else {
        showToast('모든 연결에 실패했습니다. 다시 시도하세요.', 'error');
    }
    
    resetConnectButton();
}

// Supabase 테이블 존재 여부 확인 및 생성
async function checkSupabaseTable() {
    // 테이블 존재 여부 확인
    try {
        // production_plans 테이블 조회 시도
        const { data, error } = await supabaseClient
            .from('production_plans')
            .select('id')
            .limit(1);
        
        if (error) {
            // 테이블이 없는 경우 생성 시도
            if (error.code === '42P01') {  // 테이블 없음 에러 코드
                console.log('테이블이 없습니다. 생성 시도...');
                await createProductionPlansTable();
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('Supabase 테이블 확인 오류:', error);
        throw error;
    }
}

// production_plans 테이블 생성
async function createProductionPlansTable() {
    try {
        // SQL 에디터를 통한 테이블 생성은 어렵기 때문에
        // 대신 사용자에게 안내
        console.warn('production_plans 테이블이 존재하지 않습니다.');
        showToast('Supabase에 production_plans 테이블을 생성해주세요', 'warning', 10000);
        
        // 임시로 로컬 모드로 전환
        isConnected.supabase = false;
    } catch (error) {
        console.error('테이블 생성 오류:', error);
        throw error;
    }
}

// 데이터 로드
async function loadData() {
    try {
        // 로컬 스토리지에서 먼저 로드
        const localData = localStorage.getItem('productionPlans');
        if (localData) {
            productionPlans = JSON.parse(localData);
        }
        
        // Supabase에서 로드
        if (isConnected.supabase) {
            const { data, error } = await supabaseClient
                .from('production_plans')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) {
                throw error;
            }
            
            if (data && data.length > 0) {
                // 로컬 데이터와 병합 (중복 ID 제거)
                const existingIds = productionPlans.map(plan => plan.id);
                const newPlans = data.filter(plan => !existingIds.includes(plan.id));
                productionPlans = [...productionPlans, ...newPlans];
            }
        }
        
        // GitHub에서 로드
        if (isConnected.github) {
            try {
                const githubData = await loadFromGitHub();
                
                if (githubData && githubData.plans && githubData.plans.length > 0) {
                    // 기존 데이터와 병합 (중복 ID 제거)
                    const existingIds = productionPlans.map(plan => plan.id);
                    const newPlans = githubData.plans.filter(plan => !existingIds.includes(plan.id));
                    productionPlans = [...productionPlans, ...newPlans];
                }
            } catch (error) {
                console.warn('GitHub 데이터 로드 실패:', error);
                // 데이터 로드 실패해도 진행
            }
        }
        
        // UI 업데이트
        updateUI();
        showToast('데이터를 성공적으로 로드했습니다', 'success');
    } catch (error) {
        console.error('데이터 로드 오류:', error);
        showToast('데이터 로드 중 오류가 발생했습니다', 'error');
    }
}

// GitHub에서 데이터 로드
async function loadFromGitHub() {
    try {
        const url = `https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo_name}/contents/data.json`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${githubConfig.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        // 404 오류는 파일이 없는 경우이므로 빈 데이터 반환
        if (response.status === 404) {
            return { plans: [] };
        }
        
        if (!response.ok) {
            throw new Error(`GitHub API 오류: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Base64 디코딩
        const content = atob(data.content.replace(/\s/g, ''));
        return JSON.parse(content);
    } catch (error) {
        console.error('GitHub 데이터 로드 오류:', error);
        throw error;
    }
}

// 데이터 저장
async function saveData() {
    try {
        // 저장 상태 표시
        elements.saveStatusText.textContent = '저장 중...';
        elements.saveStatus.classList.add('saving');
        elements.saveButton.disabled = true;
        elements.saveButton.textContent = '저장 중...';
        
        // 로컬 스토리지에 저장
        localStorage.setItem('productionPlans', JSON.stringify(productionPlans));
        
        // Supabase에 저장
        if (isConnected.supabase) {
            await saveToSupabase();
        }
        
        // GitHub에 저장
        if (isConnected.github) {
            await saveToGitHub();
        }
        
        // 저장 완료 상태 표시
        elements.saveStatusText.textContent = '저장 완료';
        elements.saveStatus.classList.remove('saving');
        elements.saveStatus.classList.add('saved');
        elements.saveButton.disabled = false;
        elements.saveButton.textContent = '💾 저장';
        
        // 3초 후 상태 초기화
        setTimeout(() => {
            elements.saveStatusText.textContent = '자동저장 활성화';
            elements.saveStatus.classList.remove('saved');
        }, 3000);
        
        showToast('데이터가 성공적으로 저장되었습니다', 'success');
    } catch (error) {
        console.error('데이터 저장 오류:', error);
        elements.saveStatusText.textContent = '저장 실패';
        elements.saveStatus.classList.remove('saving');
        elements.saveStatus.classList.add('error');
        elements.saveButton.disabled = false;
        elements.saveButton.textContent = '💾 저장';
        
        // 3초 후 상태 초기화
        setTimeout(() => {
            elements.saveStatusText.textContent = '자동저장 활성화';
            elements.saveStatus.classList.remove('error');
        }, 3000);
        
        showToast('데이터 저장 중 오류가 발생했습니다: ' + error.message, 'error');
    }
}

// Supabase에 저장
async function saveToSupabase() {
    try {
        // 기존 데이터 삭제 후 새로 저장 (upsert 사용)
        const { error } = await supabaseClient
            .from('production_plans')
            .upsert(
                productionPlans.map(plan => ({
                    id: plan.id,
                    customer: plan.customer,
                    product_id: plan.productId,
                    product_name: plan.productName,
                    quantity: parseInt(plan.quantity.toString().replace(/,/g, '')),
                    process_line: plan.processLine,
                    start_date: plan.startDate,
                    end_date: plan.endDate,
                    created_at: plan.created_at || new Date().toISOString()
                }))
            );
        
        if (error) {
            // RLS 정책 오류 처리 (RLS 정책이 없는 경우)
            if (error.code === 'PGRST301' || error.message.includes('policy')) {
                console.warn('RLS 정책 오류. SQL 에디터에서 다음 코드를 실행하세요:');
                console.warn(`
                -- RLS 정책 설정
                ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS "Allow anonymous access" ON production_plans;
                CREATE POLICY "Allow anonymous access" ON production_plans FOR ALL USING (true);
                `);
                
                showToast('Supabase RLS 정책을 설정해주세요', 'warning', 10000);
                return;
            }
            
            throw error;
        }
    } catch (error) {
        console.error('Supabase 저장 오류:', error);
        throw error;
    }
}

// GitHub에 저장
async function saveToGitHub() {
    try {
        const data = {
            plans: productionPlans,
            lastUpdated: new Date().toISOString()
        };
        
        // JSON 문자열 변환 및 Base64 인코딩
        const content = btoa(JSON.stringify(data, null, 2));
        
        // 기존 파일의 SHA 확인
        let sha = '';
        try {
            const fileInfoResponse = await fetch(
                `https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo_name}/contents/data.json`,
                {
                    headers: {
                        'Authorization': `token ${githubConfig.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            
            if (fileInfoResponse.ok) {
                const fileInfo = await fileInfoResponse.json();
                sha = fileInfo.sha;
            }
        } catch (error) {
            console.log('파일이 존재하지 않아 새로 생성합니다.');
        }
        
        // 파일 생성 또는 업데이트
        const url = `https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo_name}/contents/data.json`;
        
        const payload = {
            message: '생산계획 데이터 업데이트',
            content: content
        };
        
        // 기존 파일이 있는 경우 SHA 추가
        if (sha) {
            payload.sha = sha;
        }
        
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${githubConfig.token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`GitHub API 오류: ${response.status} - ${errorData.message}`);
        }
    } catch (error) {
        console.error('GitHub 저장 오류:', error);
        throw error;
    }
}

// 자동 저장 설정
function setupAutoSave() {
    // 기존 인터벌 제거
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
    }
    
    // 5분마다 자동 저장
    autoSaveInterval = setInterval(() => {
        // 연결된 상태에서만 자동 저장
        if (isConnected.supabase || isConnected.github) {
            saveData();
        }
    }, 300000); // 5분 = 300,000ms
}

// 생산계획 추가
function addProductionPlan() {
    const customer = document.getElementById('customer').value.trim();
    const productId = document.getElementById('productId').value.trim();
    const productName = document.getElementById('productName').value.trim();
    const quantityStr = document.getElementById('quantity').value.trim();
    const processLine = document.getElementById('processLine').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    // 유효성 검사
    if (!customer || !productId || !productName || !quantityStr || !processLine || !startDate || !endDate) {
        showToast('모든 필드를 입력해주세요', 'error');
        return;
    }
    
    // 수주량 숫자 변환
    const quantity = parseInt(quantityStr.replace(/,/g, ''));
    if (isNaN(quantity) || quantity <= 0) {
        showToast('수주량은 0보다 큰 숫자를 입력해주세요', 'error');
        return;
    }
    
    // 날짜 유효성 검사
    if (new Date(startDate) > new Date(endDate)) {
        showToast('시작일은 완료일보다 빨라야 합니다', 'error');
        return;
    }
    
    // 새 계획 생성
    const newPlan = {
        id: 'plan_' + Date.now(),
        customer: customer,
        productId: productId,
        productName: productName,
        quantity: quantity,
        processLine: processLine,
        startDate: startDate,
        endDate: endDate,
        created_at: new Date().toISOString()
    };
    
    // 계획 추가
    productionPlans.push(newPlan);
    
    // UI 업데이트
    updateUI();
    
    // 폼 초기화
    document.getElementById('planForm').reset();
    
    // 데이터 저장
    saveData();
    
    showToast('생산계획이 추가되었습니다', 'success');
}

// 생산계획 삭제
function deletePlan(id) {
    if (confirm('정말 이 계획을 삭제하시겠습니까?')) {
        // ID로 계획 찾기
        const index = productionPlans.findIndex(plan => plan.id === id);
        
        if (index !== -1) {
            // 계획 삭제
            productionPlans.splice(index, 1);
            
            // UI 업데이트
            updateUI();
            
            // 데이터 저장
            saveData();
            
            showToast('계획이 삭제되었습니다', 'success');
        }
    }
}

// UI 업데이트
function updateUI() {
    // 계획 목록 업데이트
    updatePlanningTable();
    
    // 간트차트 업데이트
    updateGanttChart();
    
    // 계획 개수 업데이트
    elements.planCount.textContent = `총 ${productionPlans.length}개`;
}

// 계획 목록 업데이트
function updatePlanningTable() {
    const tableBody = elements.planningTableBody;
    tableBody.innerHTML = '';
    
    if (productionPlans.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="8" class="no-data">등록된 생산계획이 없습니다.</td>`;
        tableBody.appendChild(row);
        return;
    }
    
    // 날짜순 정렬
    const sortedPlans = [...productionPlans].sort((a, b) => {
        return new Date(a.startDate) - new Date(b.startDate);
    });
    
    sortedPlans.forEach(plan => {
        const row = document.createElement('tr');
        
        // 천 단위 콤마가 있는 수주량
        const formattedQuantity = Number(plan.quantity).toLocaleString('ko-KR');
        
        row.innerHTML = `
            <td>${plan.customer}</td>
            <td>${plan.productId}</td>
            <td>${plan.productName}</td>
            <td>${formattedQuantity} EA</td>
            <td>
                <span class="process-badge" style="background-color: ${getProcessColor(plan.processLine)}">
                    ${plan.processLine}
                </span>
            </td>
            <td>${formatDate(plan.startDate)}</td>
            <td>${formatDate(plan.endDate)}</td>
            <td>
                <button class="btn btn--error btn--sm" onclick="deletePlan('${plan.id}')">삭제</button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// 간트차트 업데이트
function updateGanttChart() {
    const ganttChart = elements.ganttChart;
    ganttChart.innerHTML = '';
    
    // 현재 주의 날짜 범위 계산
    const weekStart = getWeekStart(currentWeek);
    const weekDates = [];
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        weekDates.push(date);
    }
    
    // 요일 헤더 생성
    const headerRow = document.createElement('div');
    headerRow.className = 'gantt-header';
    
    weekDates.forEach(date => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'gantt-day-header';
        
        // 오늘 날짜 강조
        const today = new Date();
        if (
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear()
        ) {
            dayHeader.classList.add('today');
        }
        
        // 주말 강조
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            dayHeader.classList.add('weekend');
        }
        
        dayHeader.innerHTML = `
            <div class="day-name">${getDayName(dayOfWeek)}</div>
            <div class="day-date">${date.getDate()}</div>
        `;
        
        headerRow.appendChild(dayHeader);
    });
    
    ganttChart.appendChild(headerRow);
    
    // 계획이 없는 경우
    if (productionPlans.length === 0) {
        const emptyRow = document.createElement('div');
        emptyRow.className = 'gantt-empty';
        emptyRow.textContent = '등록된 생산계획이 없습니다.';
        ganttChart.appendChild(emptyRow);
        return;
    }
    
    // 공정라인별 계획 그룹화
    const processList = ['PTP1', 'PTP2', '분말스틱1', '분말스틱2', '분말스틱3'];
    
    processList.forEach(processLine => {
        // 해당 공정라인의 계획 필터링
        const processPlans = productionPlans.filter(plan => plan.processLine === processLine);
        
        // 해당 공정라인에 계획이 없으면 표시하지 않음
        if (processPlans.length === 0) return;
        
        // 공정라인 행 생성
        const processRow = document.createElement('div');
        processRow.className = 'gantt-process-row';
        
        // 공정라인 레이블
        const processLabel = document.createElement('div');
        processLabel.className = 'gantt-process-label';
        processLabel.textContent = processLine;
        processLabel.style.backgroundColor = getProcessColor(processLine);
        processRow.appendChild(processLabel);
        
        // 날짜 셀 생성
        const daysContainer = document.createElement('div');
        daysContainer.className = 'gantt-days-container';
        
        weekDates.forEach(date => {
            const dayCell = document.createElement('div');
            dayCell.className = 'gantt-day-cell';
            
            // 오늘 날짜 강조
            const today = new Date();
            if (
                date.getDate() === today.getDate() &&
                date.getMonth() === today.getMonth() &&
                date.getFullYear() === today.getFullYear()
            ) {
                dayCell.classList.add('today');
            }
            
            // 주말 강조
            const dayOfWeek = date.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                dayCell.classList.add('weekend');
            }
            
            // 해당 날짜에 해당하는 계획 표시
            const dateStr = formatDateForComparison(date);
            const dayPlans = processPlans.filter(plan => {
                const startDate = plan.startDate;
                const endDate = plan.endDate;
                return dateStr >= startDate && dateStr <= endDate;
            });
            
            // 계획 표시
            dayPlans.forEach(plan => {
                const planItem = document.createElement('div');
                planItem.className = 'gantt-plan-item';
                planItem.textContent = plan.productName;
                planItem.style.backgroundColor = getProcessColor(plan.processLine);
                
                // 계획 상세정보 툴팁
                planItem.addEventListener('mouseenter', (e) => {
                    showTooltip(e, plan);
                });
                
                planItem.addEventListener('mouseleave', () => {
                    hideTooltip();
                });
                
                dayCell.appendChild(planItem);
            });
            
            daysContainer.appendChild(dayCell);
        });
        
        processRow.appendChild(daysContainer);
        ganttChart.appendChild(processRow);
    });
}

// 현재 주 표시 업데이트
function updateCurrentWeekDisplay() {
    const weekStart = getWeekStart(currentWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const startMonth = weekStart.getMonth() + 1;
    const endMonth = weekEnd.getMonth() + 1;
    
    if (startMonth === endMonth) {
        elements.currentWeek.textContent = `${weekStart.getFullYear()}년 ${startMonth}월 ${weekStart.getDate()}일 ~ ${weekEnd.getDate()}일`;
    } else {
        elements.currentWeek.textContent = `${weekStart.getFullYear()}년 ${startMonth}월 ${weekStart.getDate()}일 ~ ${endMonth}월 ${weekEnd.getDate()}일`;
    }
}

// 주 변경
function changeWeek(direction) {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() + direction * 7);
    currentWeek = newDate;
    
    updateCurrentWeekDisplay();
    updateGanttChart();
}

// 모달 닫기
function closeModal() {
    elements.connectionModal.style.display = 'none';
    elements.mainApp.classList.remove('hidden');
}

// 모든 모달 닫기
function closeAllModals() {
    elements.connectionModal.style.display = 'none';
    elements.mainApp.classList.remove('hidden');
}

// 연결 버튼 초기화
function resetConnectButton() {
    elements.connectButton.classList.remove('loading');
    elements.connectButton.textContent = '🔗 연결하기';
}

// 토스트 알림 표시
function showToast(message, type = 'info', duration = 3000) {
    const toast = elements.toast;
    const toastMessage = elements.toastMessage;
    
    // 이전 클래스 제거
    toast.className = 'toast';
    
    // 타입에 따른 클래스 추가
    toast.classList.add(`toast--${type}`);
    
    // 메시지 설정
    toastMessage.textContent = message;
    
    // 토스트 표시
    toast.classList.add('show');
    
    // 지정된 시간 후 토스트 숨기기
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// 연결 상태 표시기 업데이트
function updateConnectionIndicator() {
    const indicator = elements.connectionIndicator;
    
    if (isConnected.supabase && isConnected.github) {
        indicator.textContent = '🟢 온라인 (모두 연결됨)';
        indicator.className = 'status--success';
    } else if (isConnected.supabase || isConnected.github) {
        indicator.textContent = '🟠 일부 연결됨';
        indicator.className = 'status--warning';
    } else {
        indicator.textContent = '🔴 오프라인';
        indicator.className = 'status--error';
    }
}

// 툴팁 표시
function showTooltip(event, plan) {
    const tooltip = elements.tooltip;
    
    // 천 단위 콤마가 있는 수주량
    const formattedQuantity = Number(plan.quantity).toLocaleString('ko-KR');
    
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
            <span>${formattedQuantity} EA</span>
        </div>
        <div class="tooltip-detail">
            <span>공정라인:</span>
            <span>${plan.processLine}</span>
        </div>
        <div class="tooltip-detail">
            <span>기간:</span>
            <span>${formatDate(plan.startDate)} ~ ${formatDate(plan.endDate)}</span>
        </div>
    `;
    
    // 툴팁 위치 계산
    const rect = event.target.getBoundingClientRect();
    const tooltipWidth = 300; // 툴팁 너비
    
    // 화면 오른쪽 가장자리를 넘어가는지 확인
    if (rect.left + tooltipWidth > window.innerWidth) {
        tooltip.style.left = `${rect.right - tooltipWidth}px`;
    } else {
        tooltip.style.left = `${rect.left}px`;
    }
    
    tooltip.style.top = `${rect.bottom + 10}px`;
    
    // 툴팁 표시
    tooltip.classList.add('show');
}

// 툴팁 숨기기
function hideTooltip() {
    elements.tooltip.classList.remove('show');
}

// 공정라인 색상 가져오기
function getProcessColor(processLine) {
    const colors = {
        'PTP1': '#6c63ff',
        'PTP2': '#4CAF50',
        '분말스틱1': '#FF9800',
        '분말스틱2': '#E91E63',
        '분말스틱3': '#9C27B0'
    };
    
    return colors[processLine] || '#6c63ff';
}

// 주의 시작일 계산
function getWeekStart(date) {
    const result = new Date(date);
    const day = result.getDay();
    result.setDate(result.getDate() - day);
    return result;
}

// 요일 이름 가져오기
function getDayName(dayIndex) {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    return dayNames[dayIndex];
}

// 날짜 포맷
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

// 비교용 날짜 포맷
function formatDateForComparison(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}
