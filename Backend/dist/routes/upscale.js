"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const upscaleService_1 = require("../services/upscaleService");
const router = (0, express_1.Router)();
router.post('/api/upscale', async (req, res) => {
    /*
        #swagger.tags = ['Image Upscaler']
        #swagger.operationId = 'runImageUpscale'
        #swagger.summary = 'Nâng độ phân giải ảnh bằng RapidAPI AI Image Upscaler'
        #swagger.description = 'Nhận URL ảnh có sẵn, gọi POST https://ai-image-upscaler-api1.p.rapidapi.com/upscale.php với form field url, rồi lưu ảnh kết quả vào R2. Chỉ hỗ trợ deviceId và imageUrl; imageBase64, scale, outputFormat trả 400. Đây là API upscale ảnh, không tạo ảnh từ prompt. Mỗi lần Execute hợp lệ có thể tiêu thụ quota RapidAPI. Response provider và đường dẫn polling hiện chưa được xác nhận bằng kết quả thật.'
        #swagger.consumes = ['application/json']
        #swagger.produces = ['application/json']
        #swagger.parameters['body'] = {
            in: 'body',
            required: true,
            description: 'deviceId của thiết bị và URL HTTP(S) công khai của ảnh cần upscale.',
            schema: {
                $deviceId: 'swagger-upscale-test',
                $imageUrl: 'https://i.pinimg.com/564x/fd/80/3e/fd803e4f4198e87f98850c5945bdc228.jpg'
            }
        }
        #swagger.responses[200] = {
            description: 'Upscale thành công và đã lưu ảnh vào R2. Các URL dưới đây chỉ là ví dụ.',
            schema: { success: true, data: { url: 'https://r2.example.com/upscale/result.png', providerUrl: 'https://provider.example.com/result.png' } }
        }
        #swagger.responses[400] = {
            description: 'Thiếu input, URL không hợp lệ hoặc gửi trường chưa hỗ trợ.',
            schema: { success: false, message: 'This field is not publicly supported by the provider; please use imageUrl.' }
        }
        #swagger.responses[429] = {
            description: 'Provider báo giới hạn/quota. Kiểm tra hạn mức hoặc gói RapidAPI trước khi thử lại.',
            schema: { success: false, message: 'RapidAPI Upscaler quota exceeded (429): quota exceeded' }
        }
        #swagger.responses[502] = {
            description: 'Lỗi provider, response chưa nhận diện được, polling, tải ảnh hoặc lưu R2.',
            schema: { success: false, message: 'Image upscaling failed.' }
        }
        #swagger.responses[500] = {
            description: 'Lỗi nội bộ không mong đợi.',
            schema: { success: false, message: 'An unexpected error occurred while upscaling the image.' }
        }
    */
    try {
        // Preserve unsupported fields so service validation can reject them.
        const body = req.body;
        let input = body;
        if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
            const { deviceId, imageUrl, ...otherFields } = body;
            input = { ...otherFields, deviceId, imageUrl };
        }
        const result = await (0, upscaleService_1.runImageUpscale)(input);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        if (error instanceof upscaleService_1.ServiceError) {
            res.status(error.statusCode).json({ success: false, message: error.message });
            return;
        }
        const message = 'An unexpected error occurred while upscaling the image.';
        res.status(500).json({ success: false, message });
    }
});
exports.default = router;
