// public/main.js

// Chart.js Datalabels 플러그인 임포트 (번들링 환경일 경우)
// 만약 HTML에서 <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels"></script>
// 와 같이 로드하고 있다면 이 import 문은 필요 없습니다.
// import ChartDataLabels from 'chartjs-plugin-datalabels'; // <-- 필요시 추가, 아니면 제거

document.addEventListener('DOMContentLoaded', () => {
    // 1. DOM 요소 가져오기
    const profileForm = document.getElementById('profile_form');
    const fileInput = document.getElementById('profile_file_input');
    const uploadStatus = document.getElementById('upload_status');
    const profileListContainer = document.getElementById('profile_list_container'); // ul의 부모 div
    const profileListUl = document.getElementById('profile_list'); // ul 요소
    const listStatus = document.getElementById('list_status');

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

    let currentChart = null; // 현재 Chart.js 인스턴스를 저장할 변수
    let currentProfileData = []; // 현재 조회된 프로파일 데이터를 저장할 변수
    let currentProfileTableName = null; // 현재 선택된 프로파일의 테이블 이름

    // 2. 함수 정의

    // 파일 업로드 처리 함수
    profileForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // 폼 기본 제출 동작 방지

        const files = fileInput.files;
        if (files.length === 0) {
            uploadStatus.textContent = '파일을 선택해주세요.';
            uploadStatus.className = 'status-message error';
            return;
        }

        uploadStatus.textContent = '파일을 업로드하는 중...';
        uploadStatus.className = 'status-message';

        const fileDataArray = []; // 서버로 보낼 파일 데이터 배열

        try {
            for (const file of files) {
                const text = await file.text(); // 파일 내용을 텍스트로 읽기
                // 줄바꿈으로 분리, 공백 제거, 빈 줄 제거
                const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

                if (lines.length === 0) {
                    throw new Error(`${file.name}: 파일 내용이 비어있습니다.`);
                }

                // 파일 이름에서 확장자 제거 및 소문자 변환 (테이블 이름으로 사용)
                let fileNameWithoutExtension = file.name;
                const lastDotIndex = fileNameWithoutExtension.lastIndexOf('.');
                if (lastDotIndex !== -1 && lastDotIndex > 0) {
                    fileNameWithoutExtension = fileNameWithoutExtension.substring(0, lastDotIndex);
                }
                const tableName = fileNameWithoutExtension.toLowerCase(); // 이 tableName은 이미 정제된 상태

                const parsedRows = [];
                for (let i = 1; i < lines.length; i++) { // 첫 번째 줄은 헤더이므로 건너뜜
                    const parts = lines[i].split(/\s+/).map(part => part.trim()); // 공백으로 분리
                    if (parts.length >= 3) { // 최소한 core, task, usaged가 있는지 확인
                        const core = parts[0];
                        const task = parts[1];
                        const usaged = parseInt(parts[2], 10); // usaged는 숫자로 변환

                        if (!isNaN(usaged)) { // usaged가 유효한 숫자인지 확인
                            parsedRows.push({ core, task, usaged });
                        } else {
                            console.warn(`"${file.name}" 파일에서 유효하지 않은 Usaged 값 발견: ${parts[2]} (줄: ${i + 1})`);
                        }
                    } else {
                        console.warn(`"${file.name}" 파일에서 파싱할 수 없는 줄 발견 (컬럼 부족): "${lines[i]}" (줄: ${i + 1})`);
                    }
                }

                // 서버의 createDynamicTable은 fileData[0][0]을 테이블 이름으로,
                // fileData.slice(1)을 [core, task, usaged] 배열로 기대합니다.
                const dataToSend = [[tableName]]; // 첫 번째 요소는 테이블 이름 (배열 안에 배열)
                parsedRows.forEach(row => {
                    dataToSend.push([row.core, row.task, row.usaged]); // 각 row를 [core, task, usaged] 배열로 추가
                });

                fileDataArray.push(dataToSend); // 최종적으로 이 dataToSend를 서버로 보냅니다.
            }

            // 모든 파일의 데이터를 한 번의 요청으로 서버에 전송
            const response = await fetch('/profiles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(fileDataArray)
            });

            const result = await response.json();

            if (response.ok) {
                uploadStatus.textContent = result.message;
                uploadStatus.className = 'status-message success';
                fetchAndRenderProfileList(); // 성공 시 프로파일 목록 새로고침
            } else {
                throw new Error(result.message || '파일 업로드 실패');
            }

        } catch (error) {
            console.error('파일 업로드 오류:', error);
            uploadStatus.textContent = `오류: ${error.message}`;
            uploadStatus.className = 'status-message error';
        }
    });

    // 프로파일 목록 가져와서 렌더링 함수
    async function fetchAndRenderProfileList() {
        listStatus.textContent = '프로파일 목록을 불러오는 중...';
        listStatus.className = 'status-message';
        try {
            const response = await fetch('/profiles'); // GET /profiles 요청
            if (!response.ok) {
                throw new Error('프로파일 목록을 불러오는 데 실패했습니다.');
            }
            const tableNames = await response.json(); // 응답은 테이블 이름 배열 (예: ['profile1', 'profile2'])

            profileListUl.innerHTML = ''; // 기존 목록 초기화
            if (tableNames.length === 0) {
                profileListUl.innerHTML = '<li class="no-profiles">저장된 프로파일이 없습니다.</li>';
                listStatus.textContent = '';
                chartControls.classList.add('hidden'); // 차트 컨트롤 숨김
            } else {
                tableNames.forEach(tableName => {
                    const li = document.createElement('li');
                    li.setAttribute('data-table-name', tableName);
                    li.innerHTML = `
                        <span class="table-name">${tableName}</span>
                        <div class="button-group">
                            <button class="button secondary view-profile" data-table-name="${tableName}">조회</button>
                            <button class="button danger delete-profile" data-table-name="${tableName}">삭제</button>
                        </div>
                    `;
                    profileListUl.appendChild(li);
                });
                listStatus.textContent = '';
                // 프로파일 목록이 있으면 차트 컨트롤 표시
                chartControls.classList.remove('hidden');
            }
        } catch (error) {
            console.error('프로파일 목록 로드 오류:', error);
            listStatus.textContent = `오류: ${error.message}`;
            listStatus.className = 'status-message error';
            chartControls.classList.add('hidden'); // 오류 시 차트 컨트롤 숨김
        }
    }

    // "조회" 버튼 클릭 시 프로파일 데이터 로드 및 차트 그리기
    profileListUl.addEventListener('click', async (event) => {
        const target = event.target;
        if (target.classList.contains('view-profile')) {
            const tableName = target.dataset.tableName;
            if (!tableName) {
                alert('테이블 이름을 찾을 수 없습니다.');
                return;
            }

            chartStatus.textContent = `${tableName} 프로파일 데이터를 불러오는 중...`;
            chartStatus.className = 'status-message';

            try {
                const response = await fetch(`/profiles/${tableName}`);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || '프로파일 데이터 로드 실패');
                }
                currentProfileData = await response.json();
                currentProfileTableName = tableName; // 현재 선택된 테이블 이름 저장

                currentProfileNameSpan.textContent = `현재 선택된 프로파일: ${tableName}`;
                chartStatus.textContent = ''; // 상태 메시지 초기화

                // 조회된 데이터를 바탕으로 Core 및 Task 필터 옵션 업데이트
                updateFilterOptions(currentProfileData);

                // 차트 그리기 (초기 로드는 전체 데이터, 기본 차트 타입)
                drawChart(currentProfileData, chartTypeSelect.value, groupBySelect.value);

            } catch (error) {
                console.error('프로파일 데이터 조회 오류:', error);
                chartStatus.textContent = `오류: ${error.message}`;
                chartStatus.className = 'status-message error';
                currentProfileData = []; // 오류 발생 시 데이터 초기화
                currentProfileTableName = null;
                currentProfileNameSpan.textContent = '현재 선택된 프로파일: 없음';
                if (currentChart) {
                    currentChart.destroy();
                    currentChart = null;
                }
                selectCore.innerHTML = '<option value="all">전체 Core</option>';
                selectTask.innerHTML = '<option value="all">전체 Task</option>';
            }
        } else if (target.classList.contains('delete-profile')) {
            const tableName = target.dataset.tableName;
            if (!tableName) {
                alert('테이블 이름을 찾을 수 없습니다.');
                return;
            }

            if (confirm(`정말로 "${tableName}" 프로파일을 삭제하시겠습니까?`)) {
                try {
                    const response = await fetch(`/profiles/drop/${tableName}`, {
                        method: 'DELETE'
                    });

                    const result = await response.json();
                    if (response.ok) {
                        alert(result.message);
                        fetchAndRenderProfileList(); // 삭제 후 목록 새로고침
                        // 현재 선택된 프로파일이 삭제된 경우 차트 초기화
                        if (currentProfileTableName === tableName) {
                            currentProfileData = [];
                            currentProfileTableName = null;
                            currentProfileNameSpan.textContent = '현재 선택된 프로파일: 없음';
                            if (currentChart) {
                                currentChart.destroy();
                                currentChart = null;
                            }
                            selectCore.innerHTML = '<option value="all">전체 Core</option>';
                            selectTask.innerHTML = '<option value="all">전체 Task</option>';
                        }
                    } else {
                        throw new Error(result.message || '프로파일 삭제 실패');
                    }
                } catch (error) {
                    console.error('프로파일 삭제 오류:', error);
                    alert(`오류: ${error.message}`);
                }
            }
        }
    });

    // Core 및 Task 필터 옵션 업데이트 함수
    function updateFilterOptions(data) {
        const cores = [...new Set(data.map(d => d.core))].sort();
        const tasks = [...new Set(data.map(d => d.task))].sort();

        selectCore.innerHTML = '<option value="all">전체 Core</option>' +
            cores.map(core => `<option value="${core}">${core}</option>`).join('');
        selectTask.innerHTML = '<option value="all">전체 Task</option>' +
            tasks.map(task => `<option value="${task}">${task}</option>`).join('');

        // 현재 선택된 값으로 필터 UI 초기화
        selectCore.value = 'all';
        selectTask.value = 'all';

        // 그룹화 기준에 따라 필터 UI 표시/숨김
        toggleFilterVisibility(groupBySelect.value);
    }

    // 그룹화 기준 선택 시 필터 UI 표시/숨김
    groupBySelect.addEventListener('change', (event) => {
        const groupByValue = event.target.value;
        toggleFilterVisibility(groupByValue);
        // 그룹화 기준이 변경되면 차트 다시 그림
        if (currentProfileData.length > 0) {
            drawChart(currentProfileData, chartTypeSelect.value, groupByValue);
        }
    });

    function toggleFilterVisibility(groupByValue) {
        coreSelectContainer.classList.add('hidden');
        selectCore.value = 'all'; // 초기화
        taskSelectContainer.classList.add('hidden');
        selectTask.value = 'all'; // 초기화

        if (groupByValue === 'core') {
            coreSelectContainer.classList.remove('hidden');
        } else if (groupByValue === 'task') {
            taskSelectContainer.classList.remove('hidden');
        }
    }


    // "차트 업데이트" 버튼 클릭 시 차트 다시 그리기
    updateChartButton.addEventListener('click', () => {
        if (currentProfileData.length === 0) {
            chartStatus.textContent = '표시할 프로파일 데이터가 없습니다.';
            chartStatus.className = 'status-message error';
            return;
        }

        const chartType = chartTypeSelect.value;
        const groupBy = groupBySelect.value;

        drawChart(currentProfileData, chartType, groupBy);
    });

    // Core 또는 Task 선택 시 차트 업데이트 (이벤트 위임 사용)
    coreSelectContainer.addEventListener('change', () => {
        if (currentProfileData.length > 0) {
            drawChart(currentProfileData, chartTypeSelect.value, groupBySelect.value);
        }
    });
    taskSelectContainer.addEventListener('change', () => {
        if (currentProfileData.length > 0) {
            drawChart(currentProfileData, chartTypeSelect.value, groupBySelect.value);
        }
    });


    // 차트 그리기 함수
    function drawChart(data, chartType, groupBy) {
        if (currentChart) {
            currentChart.destroy(); // 기존 차트 인스턴스 파괴
        }

        let filteredData = [...data]; // 원본 데이터 복사

        // 필터 적용
        const selectedCore = selectCore.value;
        const selectedTask = selectTask.value;

        if (groupBy === 'core' && selectedCore !== 'all') {
            filteredData = filteredData.filter(d => d.core === selectedCore);
        } else if (groupBy === 'task' && selectedTask !== 'all') {
            filteredData = filteredData.filter(d => d.task === selectedTask);
        }

        // 데이터 집계
        const aggregatedData = {};
        let labels = [];
        let datasets = [];

        if (groupBy === 'none') {
            // 전체 데이터 (task별로 usaged를 보여줌)
            labels = [...new Set(filteredData.map(d => d.task))].sort();
            const usagedValues = labels.map(task => {
                // 특정 task에 대한 모든 usaged 값의 평균 또는 합계 (여기서는 평균)
                const relevantData = filteredData.filter(d => d.task === task);
                return relevantData.length > 0 ? relevantData.reduce((sum, d) => sum + d.usaged, 0) / relevantData.length : 0;
            });

            datasets.push({
                label: '평균 Usaged',
                data: usagedValues,
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1,
                fill: false, // 선 차트에서 영역 채우지 않음
            });

        } else if (groupBy === 'core') {
            // Core별로 usaged 집계 (각 core의 task별 usaged 또는 평균 usaged)
            const cores = [...new Set(filteredData.map(d => d.core))].sort();
            const tasks = [...new Set(filteredData.map(d => d.task))].sort();

            labels = tasks; // x축 레이블은 task
            datasets = cores.map(core => {
                const dataForCore = labels.map(task => {
                    const relevantData = filteredData.filter(d => d.core === core && d.task === task);
                    return relevantData.length > 0 ? relevantData.reduce((sum, d) => sum + d.usaged, 0) / relevantData.length : 0;
                });
                return {
                    label: `Core: ${core}`,
                    data: dataForCore,
                    backgroundColor: `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.6)`,
                    borderColor: `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 1)`,
                    borderWidth: 1,
                    fill: false,
                };
            });

        } else if (groupBy === 'task') {
            // Task별로 usaged 집계 (각 task의 core별 usaged 또는 평균 usaged)
            const tasks = [...new Set(filteredData.map(d => d.task))].sort();
            const cores = [...new Set(filteredData.map(d => d.core))].sort();

            labels = cores; // x축 레이블은 core
            datasets = tasks.map(task => {
                const dataForTask = labels.map(core => {
                    const relevantData = filteredData.filter(d => d.task === task && d.core === core);
                    return relevantData.length > 0 ? relevantData.reduce((sum, d) => sum + d.usaged, 0) / relevantData.length : 0;
                });
                return {
                    label: `Task: ${task}`,
                    data: dataForTask,
                    backgroundColor: `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.6)`,
                    borderColor: `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 1)`,
                    borderWidth: 1,
                    fill: false,
                };
            });
        }

        const chartConfig = {
            type: chartType,
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // 컨테이너에 맞춰 크기 조절
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    },
                    datalabels: { // chartjs-plugin-datalabels 설정
                        display: true,
                        color: 'black',
                        font: {
                            weight: 'bold'
                        },
                        formatter: (value) => value // 데이터 값을 직접 표시
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Usaged'
                        }
                    }
                }
            },
            // plugins: [ChartDataLabels] // 플러그인 등록 (만약 import 했다면)
        };

        // Polar Area 차트의 경우 Y축 스케일 제거
        if (chartType === 'polarArea') {
            if (chartConfig.options.scales) { // scales 속성이 존재하는지 확인 후 삭제
                delete chartConfig.options.scales;
            }
        }

        currentChart = new Chart(profilerChartCanvas, chartConfig);
    }

    // 페이지 로드 시 프로파일 목록을 가져와서 렌더링
    fetchAndRenderProfileList();
});