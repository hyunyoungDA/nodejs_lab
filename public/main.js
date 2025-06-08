document.addEventListener('DOMContentLoaded', () => {
    
    const profileForm = document.getElementById('profile_form');
    const fileInput = document.getElementById('profile_file_input');
    const uploadStatus = document.getElementById('upload_status');
    const profileListUl = document.getElementById('profile_list');

    const currentProfileNameSpan = document.getElementById('current_profile_name');
    const chartControls = document.getElementById('chart_controls');
    const chartTypeSelect = document.getElementById('chart_type');
    const groupBySelect = document.getElementById('group_by');
    const coreSelectContainer = document.getElementById('core_select_container');
    const selectCore = document.getElementById('select_core');
    const taskSelectContainer = document.getElementById('task_select_container');
    const selectTask = document.getElementById('select_task');
    const updateChartButton = document.getElementById('update_chart_button');

    const profilerChartCanvas = document.getElementById('profiler_chart');
    const chartStatus = document.getElementById('chart_status');

    // 통계 관련 DOM 요소
    const statsSection = document.getElementById('stats_section');
    const statTypeSelect = document.getElementById('stat_type');
    const statStatus = document.getElementById('stat_status'); // 통계 상태 메시지
    const overallStatsDiv = document.getElementById('overall_stats');
    const coreStatsList = document.getElementById('core_stats_list');
    const taskStatsList = document.getElementById('task_stats_list');

    let profilerChart; // Chart.js 인스턴스를 저장할 변수
    let currentProfileData = []; // 현재 로드된 프로파일 데이터 (차트 및 통계에 사용)
    let currentTableName = ''; // 현재 선택된 테이블 이름

    // 프로파일 업로드 처리
    profileForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const files = fileInput.files;
        if (files.length === 0) {
            uploadStatus.textContent = '파일을 선택해주세요.';
            uploadStatus.className = 'status-message info';
            return;
        }

        const allProfilesData = []; // [{ tableName: 'xxx', data: [{core, task, usaged}, ...]}, ...]

        for (const file of files) {
            if (file.type !== 'text/plain') {
                uploadStatus.textContent = '텍스트 파일 (.txt) 만 업로드 가능합니다.';
                uploadStatus.className = 'status-message error';
                continue;
            }

            // 파일 이름을 테이블 이름으로 사용 (확장자 제거)
            const tableName = file.name.split('.').slice(0, -1).join('.');
            // --- DEBUG LOG ---
            //console.log("DEBUG main.js (upload): Extracted tableName from filename:", tableName);
            if (!tableName) {
                 uploadStatus.textContent = `유효한 파일 이름이 아닙니다: ${file.name}`;
                 uploadStatus.className = 'status-message error';
                 continue;
            }

            const reader = new FileReader();

            // FileReader는 비동기적으로 파일을 읽으므로 Promise로 래핑
            const fileContent = await new Promise((resolve, reject) => {
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e);
                reader.readAsText(file);
            });

            // 파일 내용을 줄 단위로 분리하여 처리
            const lines = fileContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            const profileData = [];
            let currentTasksHeader = []; // 현재 섹션의 task 헤더 (task1, task2 등)

            for (const line of lines) {
                // 첫 줄 또는 섹션의 시작 줄: '\ttask1\ttask2...' 형태의 헤더
                if (line.startsWith('\t') && line.includes('task')) {
                    currentTasksHeader = line.split('\t').filter(p => p.startsWith('task'));
                } else if (line.startsWith('core')) { // core usaged 데이터
                    const parts = line.split('\t').filter(p => p.length > 0);
                    const coreName = parts[0]; // core1, core2 등
                    const usagedValues = parts.slice(1).map(Number); // usaged 값들

                    // currentTasksHeader가 비어있지 않다면, core-task 매핑
                    if (currentTasksHeader.length > 0) {
                        for (let i = 0; i < currentTasksHeader.length; i++) {
                            if (usagedValues[i] !== undefined && !isNaN(usagedValues[i])) {
                                profileData.push({ core: coreName, task: currentTasksHeader[i], usaged: usagedValues[i] });
                            }
                        }
                    } else {
                        // currentTasksHeader가 없는 경우 (단일 usaged 값으로 가정하거나 'N/A' 처리)
                        usagedValues.forEach((usaged, index) => {
                            if (!isNaN(usaged)) {
                                // 임시 task 이름 부여. inputFile.txt 첫 블록처럼 task 헤더가 없는 경우
                                profileData.push({ core: coreName, task: `GLOBAL_TASK_${index + 1}`, usaged: usaged });
                            }
                        });
                    }
                }
            }
            allProfilesData.push({ tableName: tableName, data: profileData });
        }

        try {
            const response = await fetch('/profiles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(allProfilesData),
            });

            const result = await response.json();

            if (result.status === 'success') {
                uploadStatus.textContent = `업로드 성공: ${result.message}`;
                uploadStatus.className = 'status-message success';
                await fetchProfileList(); // 목록 새로고침
            } else {
                uploadStatus.textContent = `업로드 실패: ${result.message}`;
                uploadStatus.className = 'status-message error';
            }
        } catch (error) {
            console.error('업로드 중 오류 발생:', error);
            uploadStatus.textContent = `서버 통신 오류: ${error.message}`;
            uploadStatus.className = 'status-message error';
        }
    });

    // 프로파일 목록 조회 및 렌더링
    async function fetchProfileList() {
        try {
            const response = await fetch('/profiles');
            const tableList = await response.json();

            profileListUl.innerHTML = ''; // 기존 목록 초기화

            if (tableList.length === 0) {
                profileListUl.innerHTML = '<li class="status-message info">저장된 프로파일이 없습니다.</li>';
                return;
            }

            tableList.forEach(tableName => {
                const li = document.createElement('li');
                li.dataset.tableName = tableName; // 데이터 속성 추가
                li.innerHTML = `
                    <span class="table-name">${tableName}</span>
                    <div class="button-group">
                        <button class="button secondary view-profile" data-table-name="${tableName}">조회</button>
                        <button class="button danger delete-profile" data-table-name="${tableName}">삭제</button>
                    </div>
                `;
                profileListUl.appendChild(li);
            });

            // 조회 및 삭제 버튼 이벤트 리스너 재할당
            addProfileListEventListeners();

        } catch (error) {
            console.error('프로파일 목록 조회 중 오류 발생:', error);
            profileListUl.innerHTML = `<li class="status-message error">목록을 불러오는 데 실패했습니다: ${error.message}</li>`;
        }
    }

    // 프로파일 목록 버튼 (조회, 삭제) 이벤트 리스너 할당
    function addProfileListEventListeners() {
        document.querySelectorAll('.view-profile').forEach(button => {
            button.onclick = async (event) => {
                const tableName = event.target.dataset.tableName;
                // --- DEBUG LOG ---
                console.log("DEBUG main.js (view): tableName from button dataset:", tableName);
                currentTableName = tableName; // 현재 선택된 테이블 이름 저장
                currentProfileNameSpan.textContent = tableName;
                chartControls.classList.remove('hidden'); // 차트 컨트롤 표시
                statsSection.classList.remove('hidden'); // 통계 섹션 표시
                chartStatus.textContent = `"${tableName}" 데이터 로딩 중...`;
                chartStatus.className = 'status-message info';

                // Core 및 Task 필터 초기화
                selectCore.innerHTML = '<option value="all">전체 Core</option>';
                selectTask.innerHTML = '<option value="all">전체 Task</option>';
                coreSelectContainer.classList.add('hidden');
                taskSelectContainer.classList.add('hidden');
                groupBySelect.value = 'none'; // GroupBy도 'none'으로 초기화

                try {
                    // --- DEBUG LOG ---
                    console.log("DEBUG main.js (view): Fetching data from URL:", `/profiles/${tableName}`);
                    const response = await fetch(`/profiles/${tableName}`);
                    const data = await response.json();
                    if (data.status === 'success') {
                        currentProfileData = data.data; // 전체 데이터 저장
                        chartStatus.textContent = `"${tableName}" 데이터 로드 완료. 차트를 업데이트하거나 통계를 확인하세요.`;
                        chartStatus.className = 'status-message success';

                        // 데이터 로드 후 바로 통계 불러오기 (기본: 전체 통계)
                        statTypeSelect.value = 'overall';
                        fetchAndDisplayStatistics(currentTableName, 'overall');

                        // 데이터 로드 후 차트 바로 그리기 (기본: 막대 그래프, 그룹화 없음)
                        drawChart(currentProfileData, chartTypeSelect.value, groupBySelect.value);

                        // Core 및 Task 드롭다운 메뉴 동적 채우기
                        populateCoreTaskFilters(currentProfileData);

                    } else {
                        currentProfileData = [];
                        chartStatus.textContent = `"${tableName}" 데이터 로드 실패: ${data.message}`;
                        chartStatus.className = 'status-message error';
                        // 데이터 로드 실패 시 통계 섹션도 숨김
                        statsSection.classList.add('hidden');
                    }
                } catch (error) {
                    currentProfileData = [];
                    console.error('프로파일 데이터 조회 중 오류 발생:', error);
                    chartStatus.textContent = `서버 통신 오류: ${error.message}`;
                    chartStatus.className = 'status-message error';
                    statsSection.classList.add('hidden');
                }
            };
        });

        document.querySelectorAll('.delete-profile').forEach(button => {
            button.onclick = async (event) => {
                const tableName = event.target.dataset.tableName;
                // --- DEBUG LOG ---
                console.log("DEBUG main.js (delete): tableName from button dataset:", tableName);
                if (confirm(`정말로 "${tableName}" 프로파일을 삭제하시겠습니까?`)) {
                    try {
                        const response = await fetch(`/profiles/${tableName}`, {
                            method: 'DELETE',
                        });
                        const result = await response.json();
                        if (result.status === 'success') {
                            alert(`"${tableName}" 프로파일이 성공적으로 삭제되었습니다.`);
                            await fetchProfileList(); // 목록 새로고침
                            // 현재 보고 있던 프로파일이 삭제된 경우 초기화
                            if (currentTableName === tableName) {
                                currentTableName = '';
                                currentProfileNameSpan.textContent = '선택되지 않음';
                                chartControls.classList.add('hidden');
                                statsSection.classList.add('hidden');
                                profilerChart?.destroy(); // 차트 파괴
                                chartStatus.textContent = '';
                                currentProfileData = [];
                            }
                        } else {
                            alert(`"${tableName}" 프로파일 삭제 실패: ${result.message}`);
                        }
                    } catch (error) {
                        console.error('프로파일 삭제 중 오류 발생:', error);
                        alert(`프로파일 삭제 중 서버 통신 오류가 발생했습니다: ${error.message}`);
                    }
                }
            };
        });
    }

    // 차트 그리기 기능 
    function drawChart(data, chartType, groupBy) {
        if (profilerChart) {
            profilerChart.destroy(); // 기존 차트 파괴
        }

        // 선택된 Core 또는 Task 필터 값 가져오기
        const selectedCore = selectCore.value;
        const selectedTask = selectTask.value;

        let filteredData = data;

        // Core 필터 적용
        if (selectedCore !== 'all' && selectedCore !== '') { // 빈 문자열도 처리
            filteredData = filteredData.filter(d => d.core === selectedCore);
        }

        // Task 필터 적용
        if (selectedTask !== 'all' && selectedTask !== '') { // 빈 문자열도 처리
            filteredData = filteredData.filter(d => d.task === selectedTask);
        }


        let labels = [];
        let usagedValues = [];
        let chartTitle = `${currentTableName} 프로파일`;

        // 데이터 그룹화 및 집계
        if (groupBy === 'core') {
            const coreMap = new Map();
            filteredData.forEach(item => {
                if (!coreMap.has(item.core)) {
                    coreMap.set(item.core, []);
                }
                coreMap.get(item.core).push(item.usaged);
            });
            labels = Array.from(coreMap.keys()).sort();
            usagedValues = labels.map(core => {
                const values = coreMap.get(core);
                const sum = values.reduce((acc, val) => acc + val, 0);
                return sum / values.length; // 평균 usaged
            });
            chartTitle += ' (Core별 평균 Usage)';
        } else if (groupBy === 'task') {
            const taskMap = new Map();
            filteredData.forEach(item => {
                if (!taskMap.has(item.task)) {
                    taskMap.set(item.task, []);
                }
                taskMap.get(item.task).push(item.usaged);
            });
            labels = Array.from(taskMap.keys()).sort();
            usagedValues = labels.map(task => {
                const values = taskMap.get(task);
                const sum = values.reduce((acc, val) => acc + val, 0);
                return sum / values.length; // 평균 usaged
            });
            chartTitle += ' (Task별 평균 Usage)';
        } else { // 'none' 또는 다른 경우
            labels = filteredData.map(item => `${item.core}-${item.task}`);
            usagedValues = filteredData.map(item => item.usaged);
            chartTitle += ' (전체 데이터)';
        }

        const ctx = profilerChartCanvas.getContext('2d');
        profilerChart = new Chart(ctx, {
            type: chartType,
            data: {
                labels: labels,
                datasets: [{
                    label: 'Usaged',
                    data: usagedValues,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: chartTitle,
                        font: {
                            size: 16
                        }
                    },
                    legend: {
                        display: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Usaged Value'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: groupBy === 'core' ? 'Core' : (groupBy === 'task' ? 'Task' : 'Core-Task Pair')
                        }
                    }
                }
            }
        });
    }

    // Core 및 Task 필터 드롭다운 채우기
    function populateCoreTaskFilters(data) {
        const cores = new Set();
        const tasks = new Set();

        data.forEach(item => {
            cores.add(item.core);
            tasks.add(item.task);
        });

        // Core 드롭다운 채우기
        selectCore.innerHTML = '<option value="all">전체 Core</option>';
        Array.from(cores).sort().forEach(core => {
            const option = document.createElement('option');
            option.value = core;
            option.textContent = core;
            selectCore.appendChild(option);
        });

        // Task 드롭다운 채우기
        selectTask.innerHTML = '<option value="all">전체 Task</option>';
        Array.from(tasks).sort().forEach(task => {
            const option = document.createElement('option');
            option.value = task;
            option.textContent = task;
            selectTask.appendChild(option);
        });
    }


    // ==========================================================
    // 차트 컨트롤 이벤트 리스너
    // ==========================================================
    updateChartButton.addEventListener('click', () => {
        if (currentProfileData.length === 0) {
            chartStatus.textContent = '차트를 그릴 데이터가 없습니다. 프로파일을 조회하세요.';
            chartStatus.className = 'status-message info';
            return;
        }
        drawChart(currentProfileData, chartTypeSelect.value, groupBySelect.value);
    });

    chartTypeSelect.addEventListener('change', () => {
         if (currentProfileData.length > 0) {
            drawChart(currentProfileData, chartTypeSelect.value, groupBySelect.value);
        }
    });

    groupBySelect.addEventListener('change', () => {
        const selectedGroupBy = groupBySelect.value;
        if (selectedGroupBy === 'core') {
            coreSelectContainer.classList.remove('hidden');
            taskSelectContainer.classList.add('hidden');
        } else if (selectedGroupBy === 'task') {
            taskSelectContainer.classList.remove('hidden');
            coreSelectContainer.classList.add('hidden');
        } else { // 'none'
            coreSelectContainer.classList.add('hidden');
            taskSelectContainer.classList.add('hidden');
        }
        // GroupBy 변경 시 차트 즉시 업데이트 (선택사항)
        if (currentProfileData.length > 0) {
             drawChart(currentProfileData, chartTypeSelect.value, groupBySelect.value);
        }
    });

    // Core 또는 Task 필터 변경 시 차트 즉시 업데이트 (선택사항)
    selectCore.addEventListener('change', () => {
        if (currentProfileData.length > 0) {
            drawChart(currentProfileData, chartTypeSelect.value, groupBySelect.value);
        }
    });
    selectTask.addEventListener('change', () => {
        if (currentProfileData.length > 0) {
            drawChart(currentProfileData, chartTypeSelect.value, groupBySelect.value);
        }
    });

    // 통계 유형 선택 변경 시 이벤트 리스너
    statTypeSelect.addEventListener('change', () => {
        fetchAndDisplayStatistics(currentTableName, statTypeSelect.value);
    });

    
    // 통계 데이터 조회 및 표시 함수
    async function fetchAndDisplayStatistics(tableName, statType) {
        // --- DEBUG LOG ---
        console.log(`DEBUG main.js (fetchAndDisplayStatistics): Called for tableName: "${tableName}", statType: "${statType}"`);

        if (!tableName) {
            statStatus.textContent = '통계를 볼 프로파일을 먼저 선택하세요.';
            statStatus.className = 'status-message info';
            overallStatsDiv.classList.add('hidden');
            coreStatsList.classList.add('hidden');
            taskStatsList.classList.add('hidden');
            return;
        }

        statStatus.textContent = `"${tableName}"의 ${statType} 통계 로딩 중...`;
        statStatus.className = 'status-message info';

        // 모든 통계 컨테이너 숨김 및 내용 초기화
        overallStatsDiv.classList.add('hidden');
        coreStatsList.classList.add('hidden');
        taskStatsList.classList.add('hidden');
        overallStatsDiv.innerHTML = '';
        coreStatsList.innerHTML = '';
        taskStatsList.innerHTML = '';

        try {
            // --- DEBUG LOG ---
            //console.log(`DEBUG main.js (fetchAndDisplayStatistics): Fetching stats from URL: /profiles/${tableName}/statistics/${statType}`);
            const response = await fetch(`/profiles/${tableName}/statistics/${statType}`);
            const stats = await response.json();

            if (response.ok) {
                statStatus.textContent = `"${tableName}"의 ${statType} 통계 로드 완료.`;
                statStatus.className = 'status-message success';

                if (statType === 'overall') {
                    overallStatsDiv.classList.remove('hidden');
                    overallStatsDiv.innerHTML = `
                        <p><strong>총 레코드 수:</strong> <span class="stat-value">${stats.totalCount}</span></p>
                        <p><strong>Usaged 최소값:</strong> <span class="stat-value">${stats.min.toFixed(2)}</span></p>
                        <p><strong>Usaged 최대값:</strong> <span class="stat-value">${stats.max.toFixed(2)}</span></p>
                        <p><strong>Usaged 평균:</strong> <span class="stat-value">${stats.avg.toFixed(2)}</span></p>
                        <p><strong>Usaged 표준편차:</strong> <span class="stat-value">${stats.stddev.toFixed(2)}</span></p>
                    `;
                } else if (statType === 'core') {
                    coreStatsList.classList.remove('hidden');
                    if (stats.length > 0) {
                        stats.forEach(stat => {
                            const li = document.createElement('li');
                            li.innerHTML = `
                                <strong>${stat.core}:</strong>
                                    Min: <span class="stat-value">${stat.min.toFixed(2)}</span>,
                                    Max: <span class="stat-value">${stat.max.toFixed(2)}</span>,
                                    Avg: <span class="stat-value">${stat.avg.toFixed(2)}</span>,
                                    StdDev: <span class="stat-value">${stat.stddev ? stat.stddev.toFixed(2) : 'N/A'}</span>
                            `;
                            coreStatsList.appendChild(li);
                        });
                    } else {
                        coreStatsList.innerHTML = '<li class="status-message info">Core별 통계 데이터가 없습니다.</li>';
                    }
                } else if (statType === 'task') {
                    taskStatsList.classList.remove('hidden');
                    if (stats.length > 0) {
                        stats.forEach(stat => {
                            const li = document.createElement('li');
                            li.innerHTML = `
                                <strong>${stat.task}:</strong>
                                    Min: <span class="stat-value">${stat.min.toFixed(2)}</span>,
                                    Max: <span class="stat-value">${stat.max.toFixed(2)}</span>,
                                    Avg: <span class="stat-value">${stat.avg.toFixed(2)}</span>,
                                    StdDev: <span class="stat-value">${stat.stddev ? stat.stddev.toFixed(2) : 'N/A'}</span>
                            `;
                            taskStatsList.appendChild(li);
                        });
                    } else {
                        taskStatsList.innerHTML = '<li class="status-message info">Task별 통계 데이터가 없습니다.</li>';
                    }
                }
            } else {
                statStatus.textContent = `통계 로드 실패: ${stats.message || '알 수 없는 오류'}`;
                statStatus.className = 'status-message error';
            }
        } catch (error) {
            console.error('통계 데이터 조회 중 오류 발생:', error);
            statStatus.textContent = `통계 로드 중 서버 통신 오류: ${error.message}`;
            statStatus.className = 'status-message error';
        }
    }


    // 페이지 로드 시 프로파일 목록 불러오기
    fetchProfileList();
});
