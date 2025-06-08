const express = require('express');
const router = express.Router();
// const Path = require('path'); 
// 미리 구현해둔 데이터베이스 관련 기능 함수 호출  
const { createDynamicTable, getTableList, dropTable, getDynamicModel } = require('../models');

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
                continue;
            }

            // createDynamicTable 함수에 fileData 전체를 전달 (테이블 이름과 데이터 행 포함)
            await createDynamicTable(fileData);
            successCount++;
        }

        if (successCount > 0) {
            res.status(201).json({ status: 'success', message: `${successCount}개의 프로파일이 성공적으로 업로드되었습니다.` });
        } else {
            res.status(200).json({ status: 'info', message: '새로운 프로파일이 없거나 모든 프로파일이 이미 존재합니다.' });
        }

    } catch (error) {
        console.error('프로파일 업로드 및 처리 중 오류 발생:', error);
        // 클라이언트에게 상세한 오류 메시지 전달
        res.status(500).json({ status: 'error', message: `프로파일 업로드 중 오류 발생: ${error.message}` });
    }
});

// GET /profiles 요청 처리 (테이블 목록 조회) - public/main.js에서 fetch('/profiles')로 호출됨
router.get('/', async (req, res) => {
    try {
        const tableList = await getTableList(); // 모델에서 테이블 목록 가져옴 (['tablename1', 'tablename2'] 형태로 반환됨)
        console.log("DEBUG: GET /profiles 라우터 - 클라이언트에게 전송할 테이블 이름 목록:", tableList); // 디버깅
        res.json(tableList); // JSON 형태로 응답 (여기서 이상한 변형이 일어나지 않아야 합니다)
    } catch (error) {
        console.error('테이블 목록 조회 중 오류 발생:', error);
        res.status(500).json({ status: 'error', message: '테이블 목록 조회에 실패했습니다.' });
    }
});

// GET /profiles/:tableName 요청 처리 (특정 프로파일 테이블의 데이터 조회)
router.get('/:tableName', async (req, res) => {
    const { tableName } = req.params; // URL 파라미터에서 테이블 이름 추출 (예: 'profile_data')

    try {
        // 테이블 이름을 기반으로 동적 모델 가져오기
        const DynamicProfileModel = getDynamicModel(tableName);
        if (!DynamicProfileModel) {
            // 이 경우 'null'이 아닌 유효하지 않은 테이블 이름이 왔을 때 404를 반환
            return res.status(404).json({ status: 'error', message: `"${tableName}" 테이블 모델을 찾을 수 없습니다.` });
        }

        // 해당 테이블의 모든 데이터 조회
        const profileData = await DynamicProfileModel.findAll({
            attributes: ['core', 'task', 'usaged'], // 필요한 컬럼만 선택
            raw: true // Sequelize 인스턴스 대신 순수 데이터 객체 반환
        });

        if (profileData.length === 0) {
            return res.status(404).json({ status: 'error', message: `"${tableName}" 테이블에 데이터가 없습니다.` });
        }

        res.json(profileData); // 조회된 데이터를 JSON 형태로 응답
    } catch (error) {
        console.error(`"${tableName}" 프로파일 데이터 조회 중 오류 발생:`, error);
        res.status(500).json({ status: 'error', message: `"${tableName}" 프로파일 데이터 조회에 실패했습니다. 오류: ${error.message}` });
    }
});

// DELETE /profiles/drop/:tableName 요청 처리 (특정 프로파일 테이블 삭제)
router.delete('/drop/:tableName', async (req, res) => {
    const { tableName } = req.params; // URL 파라미터에서 테이블 이름 추출

    try {
        // 실제 존재하는 테이블인지 한 번 더 확인 (선택 사항이지만 안전성 증대)
        const existingTableList = await getTableList();
        if (!existingTableList.includes(tableName)) {
            return res.status(404).json({ status: 'error', message: `"${tableName}" 테이블은 존재하지 않습니다.` });
        }

        await dropTable(tableName); // 테이블 삭제 함수 호출
        res.json({ status: 'success', message: `"${tableName}" 프로파일이 성공적으로 삭제되었습니다.` });
    } catch (error) {
        console.error(`"${tableName}" 프로파일 삭제 중 오류 발생:`, error);
        res.status(500).json({ status: 'error', message: `"${tableName}" 프로파일 삭제에 실패했습니다. 오류: ${error.message}` });
    }
});

module.exports = router;