export interface BaseResponse<T> {
    code: number;
    message: string;
    data: T;
}

export interface OptionRow {
    id: string;
    text: string;
    isCorrect?: boolean;
}
export interface BaseResponse<T = any> {
    code: number;
    message: string;
    data: T;
    pagination?: {
        page: number;
        limit: number;
        total: number;
    }
}