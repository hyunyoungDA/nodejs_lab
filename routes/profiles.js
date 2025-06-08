const express = require('express');
const router = express.Router();
// const Path = require('path'); // Path 모듈은 더 이상 필요 없으므로 주석 처리
// 미리 구현해둔 데이터베이스 관련 기능 함수 호출
const { createDynamicTable, getTableList, dropTable, getDynamicModel, fn, literal, Op } = require('../models');

// POST /profiles 요청 처리 (프로파일 파일 업로드)
router.post('/', async (req, res) => {
    const profiles = req.body; // profiles는 이제 [[tableName], [core,task,usaged], ...] 형태의 배열
    let successCount = 0;

    if (!profiles || profiles.length === 0) {
        return res.status(400).json({ status: 'error', message: '업로드할 프로파일 데이터가 없습니다.' });
    }

    try {
        const existingTableList = await getTableList(); // 현재 존재하는 테이블 목록 조회

        for (let file_num = 0; file_num < profiles.length; file_num++) {
            const fileData = profiles[file_num]; // 각 fileData는 특정 파일의 테이블 데이터 (테이블 이름 포함)

            // public/main.js에서 fileData[0][0]에 이미 정제된 테이블 이름이 담겨 오므로, 그대로 사용
            const tableName = fileData[0][0]; // Path.parse 제거

            if (existingTableList.includes(tableName)) {
                console.log(`[POST /profiles] ${tableName}은(는) 이미 존재하므로 건너뜁니다.`);
                continue; // 이미 존재하는 테이블이면 건너뛰기
            }

            console.log(`[POST /profiles] 새로운 테이블 생성 시도: ${tableName}`);
            // 새로운 테이블 생성 (스키마는 models/index.js의 getDynamicModel과 일치)
            await createDynamicTable(tableName);
            console.log(`[POST /profiles] 테이블 "${tableName}" 생성 완료.`);

            // 데이터 삽입
            const dataToInsert = fileData.slice(1).map(item => ({
                core: item.core,
                task: item.task,
                usaged: item.usaged
            }));

            // 동적 모델 가져오기
            const DynamicProfileModel = getDynamicModel(tableName);
            if (!DynamicProfileModel) {
                console.error(`[POST /profiles] ${tableName}에 대한 동적 모델을 가져올 수 없습니다.`);
                continue; // 모델을 가져올 수 없으면 다음 파일로
            }
            await DynamicProfileModel.bulkCreate(dataToInsert);
            console.log(`[POST /profiles] 테이블 "${tableName}"에 ${dataToInsert.length}개 데이터 삽입 완료.`);
            successCount++;
        }

        if (successCount > 0) {
            res.status(201).json({ status: 'success', message: `${successCount}개의 프로파일이 성공적으로 업로드 및 저장되었습니다.` });
        } else {
            res.status(200).json({ status: 'info', message: '새로운 프로파일이 없거나 이미 존재하여 업로드되지 않았습니다.' });
        }

    } catch (error) {
        console.error('[POST /profiles] 프로파일 업로드 중 오류 발생:', error);
        res.status(500).json({ status: 'error', message: `프로파일 업로드 중 서버 오류가 발생했습니다: ${error.message}` });
    }
});

// GET /profiles 요청 처리 (모든 프로파일 목록 조회)
router.get('/', async (req, res) => {
    try {
        const tableList = await getTableList();
        res.json(tableList);
    } catch (error) {
        console.error('[GET /profiles] 프로파일 목록 조회 중 오류 발생:', error);
        res.status(500).json({ status: 'error', message: `프로파일 목록 조회에 실패했습니다: ${error.message}` });
    }
});

// GET /profiles/:tableName 요청 처리 (특정 프로파일 데이터 조회)
router.get('/:tableName', async (req, res) => {
    const { tableName } = req.params;
    console.log(`DEBUG profiles.js (GET /:tableName): Request received for table: ${tableName}`); // DEBUG
    try {
        const DynamicProfileModel = getDynamicModel(tableName);
        if (!DynamicProfileModel) {
            console.warn(`DEBUG profiles.js (GET /:tableName): DynamicModel not found for ${tableName}.`); // DEBUG
            return res.status(404).json({ status: 'error', message: `"${tableName}" 테이블을 찾을 수 없습니다.` });
        }

        const data = await DynamicProfileModel.findAll({
            attributes: ['core', 'task', 'usaged'],
            order: [
                ['core', 'ASC'],
                ['task', 'ASC']
            ],
            raw: true, // 순수 JSON 객체로 반환
        });

        console.log(`DEBUG profiles.js (GET /:tableName): Successfully fetched ${data.length} records for ${tableName}.`); // DEBUG
        res.json({ status: 'success', data: data });

    } catch (error) {
        console.error(`ERROR profiles.js (GET /:tableName): Error fetching data for ${tableName}:`, error); // DEBUG
        // Check for specific error related to table not existing
        if (error.name === 'SequelizeAccessDeniedError' || error.original?.code === 'ER_NO_SUCH_TABLE') {
            res.status(404).json({ status: 'error', message: `"${tableName}" 테이블이 존재하지 않습니다.` });
        } else {
            res.status(500).json({ status: 'error', message: `"${tableName}" 데이터 조회에 실패했습니다. 오류: ${error.message}` });
        }
    }
});

// DELETE /profiles/:tableName 요청 처리 (특정 프로파일 삭제)
router.delete('/:tableName', async (req, res) => {
    const { tableName } = req.params;
    try {
        await dropTable(tableName); // models/index.js에서 구현된 함수 호출
        res.json({ status: 'success', message: `"${tableName}" 프로파일이 성공적으로 삭제되었습니다.` });
    } catch (error) {
        console.error(`프로파일 삭제 중 오류 발생 (${tableName}):`, error);
        res.status(500).json({ status: 'error', message: `"${tableName}" 프로파일 삭제에 실패했습니다. 오류: ${error.message}` });
    }
});

// GET /profiles/:tableName/statistics/overall 요청 처리 (전체 통계)
router.get('/:tableName/statistics/overall', async (req, res) => {
    const { tableName } = req.params;
    try {
        const DynamicProfileModel = getDynamicModel(tableName);
        if (!DynamicProfileModel) {
            return res.status(404).json({ status: 'error', message: `"${tableName}" 테이블 모델을 찾을 수 없습니다.` });
        }

        const stats = await DynamicProfileModel.findAll({
            attributes: [
                [fn('COUNT', literal('usaged')), 'totalCount'],
                [fn('MIN', literal('usaged')), 'min'],
                [fn('MAX', literal('usaged')), 'max'],
                [fn('AVG', literal('usaged')), 'avg'],
                [fn('STDDEV', literal('usaged')), 'stddev'] // 또는 `STDDEV_SAMP`, `STDDEV_POP`
            ],
            raw: true,
        });

        if (stats && stats.length > 0) {
            const overallStats = stats[0]; // 통계는 한 개의 결과 객체로 옴

            // 숫자로 변환 (문자열로 반환될 가능성 대비)
            overallStats.totalCount = parseInt(overallStats.totalCount, 10); // totalCount는 정수
            overallStats.min = parseFloat(overallStats.min);
            overallStats.max = parseFloat(overallStats.max);
            overallStats.avg = parseFloat(overallStats.avg);
            // stddev가 null일 수 있으므로 먼저 체크
            overallStats.stddev = overallStats.stddev !== null ? parseFloat(overallStats.stddev) : null;


            console.log(`DEBUG profiles.js (GET /profiles/:tableName/statistics/overall): Overall stats for "${tableName}":`, overallStats);

            res.json(overallStats);
        } else {
            res.status(404).json({ status: 'error', message: `"${tableName}" 테이블에 전체 통계 데이터가 없습니다.` });
        }
    } catch (error) {
        console.error(`ERROR profiles.js (GET /profiles/:tableName/statistics/overall): Error fetching overall stats for ${tableName}:`, error);
        res.status(500).json({ status: 'error', message: `"${tableName}" 전체 통계 조회에 실패했습니다. 오류: ${error.message}` });
    }
});

// GET /profiles/:tableName/statistics/core 요청 처리 (Core별 통계)
router.get('/:tableName/statistics/core', async (req, res) => {
    const { tableName } = req.params;
    try {
        const DynamicProfileModel = getDynamicModel(tableName);
        if (!DynamicProfileModel) {
            return res.status(404).json({ status: 'error', message: `"${tableName}" 테이블 모델을 찾을 수 없습니다.` });
        }

        const stats = await DynamicProfileModel.findAll({
            attributes: [
                'core',
                [fn('MIN', literal('usaged')), 'min'],
                [fn('MAX', literal('usaged')), 'max'],
                [fn('AVG', literal('usaged')), 'avg'],
                [fn('STDDEV', literal('usaged')), 'stddev'] // 또는 `STDDEV_SAMP`, `STDDEV_POP`
            ],
            group: ['core'],
            order: [[literal('core'), 'ASC']], // Core 이름으로 정렬
            raw: true,
        });

        if (stats && stats.length > 0) {
            // 각 통계 객체의 숫자 필드를 숫자로 변환
            const formattedStats = stats.map(stat => ({
                core: stat.core,
                min: parseFloat(stat.min),
                max: parseFloat(stat.max),
                avg: parseFloat(stat.avg),
                // stddev가 null일 수 있으므로 먼저 체크
                stddev: stat.stddev !== null ? parseFloat(stat.stddev) : null
            }));

            console.log(`DEBUG profiles.js (GET /profiles/:tableName/statistics/core): Core stats for "${tableName}":`, formattedStats);

            res.json(formattedStats);
        } else {
            res.status(404).json({ status: 'error', message: `"${tableName}" 테이블에 Core별 통계 데이터가 없습니다.` });
        }
    } catch (error) {
        console.error(`ERROR profiles.js (GET /profiles/:tableName/statistics/core): Error fetching core stats for ${tableName}:`, error);
        res.status(500).json({ status: 'error', message: `"${tableName}" Core별 통계 조회에 실패했습니다. 오류: ${error.message}` });
    }
});

// GET /profiles/:tableName/statistics/task 요청 처리 (Task별 통계)
router.get('/:tableName/statistics/task', async (req, res) => {
    const { tableName } = req.params;
    try {
        const DynamicProfileModel = getDynamicModel(tableName);
        if (!DynamicProfileModel) {
            return res.status(404).json({ status: 'error', message: `"${tableName}" 테이블 모델을 찾을 수 없습니다.` });
        }

        const stats = await DynamicProfileModel.findAll({
            attributes: [
                'task',
                [fn('MIN', literal('usaged')), 'min'],
                [fn('MAX', literal('usaged')), 'max'],
                [fn('AVG', literal('usaged')), 'avg'],
                [fn('STDDEV', literal('usaged')), 'stddev'] // 또는 `STDDEV_SAMP`, `STDDEV_POP`
            ],
            group: ['task'],
            order: [[literal('task'), 'ASC']], // Task 이름으로 정렬
            raw: true,
        });

        if (stats && stats.length > 0) {
            // 각 통계 객체의 숫자 필드를 숫자로 변환
            const formattedStats = stats.map(stat => ({
                task: stat.task,
                min: parseFloat(stat.min),
                max: parseFloat(stat.max),
                avg: parseFloat(stat.avg),
                // stddev가 null일 수 있으므로 먼저 체크
                stddev: stat.stddev !== null ? parseFloat(stat.stddev) : null
            }));

            console.log(`DEBUG profiles.js (GET /profiles/:tableName/statistics/task): Task stats for "${tableName}":`, formattedStats);

            res.json(formattedStats);
        } else {
            res.status(404).json({ status: 'error', message: `"${tableName}" 테이블에 Task별 통계 데이터가 없습니다.` });
        }
    } catch (error) {
        console.error(`ERROR profiles.js (GET /profiles/:tableName/statistics/task): Error fetching task stats for ${tableName}:`, error);
        res.status(500).json({ status: 'error', message: `"${tableName}" Task별 통계 조회에 실패했습니다. 오류: ${error.message}` });
    }
});


module.exports = router;
