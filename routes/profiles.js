const express = require('express');
const router = express.Router();
const { createDynamicTable, getTableList, dropTable, getDynamicModel, fn, literal, Op } = require('../models');

// POST /profiles 요청 처리 (프로파일 파일 업로드)
router.post('/', async (req, res) => {
    const uploadedProfiles = req.body;
    let successCount = 0;

    // --- DEBUG LOG ---
    //console.log("DEBUG profiles.js (POST /): Received uploadedProfiles (first entry):", uploadedProfiles[0]);

    if (!uploadedProfiles || uploadedProfiles.length === 0) {
        return res.status(400).json({ status: 'error', message: '업로드할 프로파일 데이터가 없습니다.' });
    }

    try {
        // 테이블 불러옴 
        const existingTableList = await getTableList();
        
        for (const profileEntry of uploadedProfiles) {
            const tableName = profileEntry.tableName;
            const dataToInsert = profileEntry.data;

            if (!tableName) {
                console.warn(`[POST /profiles] 유효한 테이블 이름이 없습니다. 스킵합니다.`);
                continue;
            }

            if (existingTableList.includes(tableName)) {
                console.log(`[POST /profiles] ${tableName}은(는) 이미 존재하므로 건너뜁니다.`);
                continue;
            }

            if (dataToInsert.length === 0) {
                console.warn(`[POST /profiles] "${tableName}" 파일에서 삽입할 유효한 데이터가 없습니다. 스킵합니다.`);
                continue;
            }

            const DynamicProfileModel = await createDynamicTable(tableName);
            await DynamicProfileModel.bulkCreate(dataToInsert);
            console.log(`[POST /profiles] "${tableName}" 테이블 생성 및 데이터 삽입 완료.`);
            successCount++;
        }

        if (successCount > 0) {
            res.json({ status: 'success', message: `${successCount}개의 프로파일이 성공적으로 업로드되었습니다.` });
        } else {
            res.status(200).json({ status: 'info', message: '새로운 프로파일이 업로드되지 않았습니다 (모두 이미 존재하거나 유효한 데이터 없음).' });
        }

    } catch (error) {
        console.error('[POST /profiles] 프로파일 업로드 중 오류 발생:', error);
        res.status(500).json({ status: 'error', message: `프로파일 업로드에 실패했습니다. 오류: ${error.message}` });
    }
});

// GET /profiles 요청 처리 (저장된 모든 프로파일 테이블 목록 조회)
router.get('/', async (req, res) => {
    try {
        const tableList = await getTableList();
        // --- DEBUG LOG ---
        console.log("DEBUG profiles.js (GET /): Returning table list:", tableList);
        res.json(tableList);
    } catch (error) {
        console.error('[GET /profiles] 테이블 목록 조회 중 오류 발생:', error);
        res.status(500).json({ status: 'error', message: `테이블 목록 조회에 실패했습니다. 오류: ${error.message}` });
    }
});

// GET /profiles/:tableName 요청 처리 (특정 프로파일 테이블의 모든 데이터 조회)
router.get('/:tableName', async (req, res) => {
    const { tableName } = req.params;
    // --- DEBUG LOG ---
    console.log(`DEBUG profiles.js (GET /:tableName): tableName from params: "${tableName}"`);
    try {
        const DynamicProfileModel = getDynamicModel(tableName);
        if (!DynamicProfileModel) {
            // --- DEBUG LOG ---
            console.error(`DEBUG profiles.js (GET /:tableName): DynamicProfileModel not found for "${tableName}"`);
            return res.status(404).json({ status: 'error', message: `"${tableName}" 테이블 모델을 찾을 수 없습니다.` });
        }

        const data = await DynamicProfileModel.findAll({
            attributes: ['core', 'task', 'usaged'],
            order: [['core', 'ASC'], ['task', 'ASC']]
        });

        if (data && data.length > 0) {
            // --- DEBUG LOG ---
            console.log(`DEBUG profiles.js (GET /:tableName): Found ${data.length} records for "${tableName}".`);
            res.json({ status: 'success', data: data });
        } else {
            console.warn(`[GET /profiles/${tableName}] "${tableName}" 테이블에 데이터가 없습니다.`);
            res.status(404).json({ status: 'error', message: `"${tableName}" 테이블에 데이터가 없습니다.` });
        }
    } catch (error) {
        console.error(`[GET /profiles/${tableName}] 데이터 조회 중 오류 발생:`, error);
        res.status(500).json({ status: 'error', message: `"${tableName}" 데이터 조회에 실패했습니다. 오류: ${error.message}` });
    }
});

// DELETE /profiles/:tableName 요청 처리 (특정 프로파일 테이블 삭제)
router.delete('/:tableName', async (req, res) => {
    const { tableName } = req.params;
    // --- DEBUG LOG ---
    console.log(`DEBUG profiles.js (DELETE /:tableName): tableName from params: "${tableName}"`);
    try {
        await dropTable(tableName);
        console.log(`[DELETE /profiles/${tableName}] "${tableName}" 테이블 삭제 완료.`);
        res.json({ status: 'success', message: `"${tableName}" 테이블이 성공적으로 삭제되었습니다.` });
    } catch (error) {
        console.error(`[DELETE /profiles/${tableName}] 테이블 삭제 중 오류 발생:`, error);
        res.status(500).json({ status: 'error', message: `"${tableName}" 테이블 삭제에 실패했습니다. 오류: ${error.message}` });
    }
});

// GET /profiles/:tableName/statistics/overall 요청 처리 -> 통계 처리 
router.get('/:tableName/statistics/overall', async (req, res) => {
    const { tableName } = req.params;
    // --- DEBUG LOG ---
    console.log(`DEBUG profiles.js (GET /:tableName/statistics/overall): tableName from params: "${tableName}"`);
    try {
        const DynamicProfileModel = getDynamicModel(tableName);
        if (!DynamicProfileModel) {
            console.error(`DEBUG profiles.js (GET /:tableName/statistics/overall): DynamicProfileModel not found for "${tableName}"`);
            return res.status(404).json({ status: 'error', message: `"${tableName}" 테이블 모델을 찾을 수 없습니다.` });
        }

        const stats = await DynamicProfileModel.findOne({
            attributes: [
                [fn('COUNT', literal('usaged')), 'totalCount'],
                [fn('MIN', literal('usaged')), 'min'],
                [fn('MAX', literal('usaged')), 'max'],
                [fn('AVG', literal('usaged')), 'avg'],
                [fn('STDDEV', literal('usaged')), 'stddev']
            ],
            raw: true,
        });

        if (stats) {
            // --- DEBUG LOG ---
            console.log(`DEBUG profiles.js (GET /:tableName/statistics/overall): Overall stats for "${tableName}":`, stats);
            res.json(stats);
        } else {
            console.warn(`[GET /profiles/${tableName}/statistics/overall] "${tableName}" 테이블에 통계 데이터가 없습니다.`);
            res.status(404).json({ status: 'error', message: `"${tableName}" 테이블에 통계 데이터가 없습니다.` });
        }
    } catch (error) {
        console.error(`[GET /profiles/${tableName}/statistics/overall] 전체 통계 조회 중 오류 발생:`, error);
        res.status(500).json({ status: 'error', message: `"${tableName}" 전체 통계 조회에 실패했습니다. 오류: ${error.message}` });
    }
});


// GET /profiles/:tableName/statistics/core 요청 처리 (Core별 통계)
router.get('/:tableName/statistics/core', async (req, res) => {
    const { tableName } = req.params;
    // --- DEBUG LOG ---
    console.log(`DEBUG profiles.js (GET /:tableName/statistics/core): tableName from params: "${tableName}"`);
    try {
        const DynamicProfileModel = getDynamicModel(tableName);
        if (!DynamicProfileModel) {
            console.error(`DEBUG profiles.js (GET /:tableName/statistics/core): DynamicProfileModel not found for "${tableName}"`);
            return res.status(404).json({ status: 'error', message: `"${tableName}" 테이블 모델을 찾을 수 없습니다.` });
        }

        const stats = await DynamicProfileModel.findAll({
            attributes: [
                'core',
                [fn('MIN', literal('usaged')), 'min'],
                [fn('MAX', literal('usaged')), 'max'],
                [fn('AVG', literal('usaged')), 'avg'],
                [fn('STDDEV', literal('usaged')), 'stddev']
            ],
            group: ['core'],
            order: [[literal('core'), 'ASC']],
            raw: true,
        });

        if (stats && stats.length > 0) {
            // --- DEBUG LOG ---
            console.log(`DEBUG profiles.js (GET /:tableName/statistics/core): Core stats for "${tableName}":`, stats);
            res.json(stats);
        } else {
            console.warn(`[GET /profiles/${tableName}/statistics/core] "${tableName}" 테이블에 Core별 통계 데이터가 없습니다.`);
            res.status(404).json({ status: 'error', message: `"${tableName}" 테이블에 Core별 통계 데이터가 없습니다.` });
        }
    } catch (error) {
        console.error(`[GET /profiles/${tableName}/statistics/core] Core별 통계 조회 중 오류 발생:`, error);
        res.status(500).json({ status: 'error', message: `"${tableName}" Core별 통계 조회에 실패했습니다. 오류: ${error.message}` });
    }
});

// GET /profiles/:tableName/statistics/task 요청 처리 (Task별 통계)
router.get('/:tableName/statistics/task', async (req, res) => {
    const { tableName } = req.params;
    // --- DEBUG LOG ---
    console.log(`DEBUG profiles.js (GET /:tableName/statistics/task): tableName from params: "${tableName}"`);
    try {
        const DynamicProfileModel = getDynamicModel(tableName);
        if (!DynamicProfileModel) {
            console.error(`DEBUG profiles.js (GET /:tableName/statistics/task): DynamicProfileModel not found for "${tableName}"`);
            return res.status(404).json({ status: 'error', message: `"${tableName}" 테이블 모델을 찾을 수 없습니다.` });
        }

        const stats = await DynamicProfileModel.findAll({
            attributes: [
                'task',
                [fn('MIN', literal('usaged')), 'min'],
                [fn('MAX', literal('usaged')), 'max'],
                [fn('AVG', literal('usaged')), 'avg'],
                [fn('STDDEV', literal('usaged')), 'stddev']
            ],
            group: ['task'],
            order: [[literal('task'), 'ASC']],
            raw: true,
        });

        if (stats && stats.length > 0) {
            // --- DEBUG LOG ---
            console.log(`DEBUG profiles.js (GET /:tableName/statistics/task): Task stats for "${tableName}":`, stats);
            res.json(stats);
        } else {
            console.warn(`[GET /profiles/${tableName}/statistics/task] "${tableName}" 테이블에 Task별 통계 데이터가 없습니다.`);
            res.status(404).json({ status: 'error', message: `"${tableName}" 테이블에 Task별 통계 데이터가 없습니다.` });
        }
    } catch (error) {
        console.error(`[GET /profiles/${tableName}/statistics/task] Task별 통계 조회 중 오류 발생:`, error);
        res.status(500).json({ status: 'error', message: `"${tableName}" Task별 통계 조회에 실패했습니다. 오류: ${error.message}` });
    }
});


module.exports = router;
