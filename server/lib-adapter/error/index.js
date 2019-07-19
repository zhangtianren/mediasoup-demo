// Error for RPC req

function E(code, message, detail) {
    return detail ? {
        code,
        message,
        detail,
    } : {
        code,
        message
    };
}

class Error {

    constructor() {}

    static NOT_AVAILABLE(detail = null) {
        return E(Error.NOT_AVAILABLE_CODE, 'NOT_AVAILABLE', detail);
    }

    static NOT_EXIST(detail = null) {
        return E(Error.NOT_EXIST_CODE, 'NOT_EXIST', detail);
    }

    static ALREADY_EXIST(detail = null) {
        return E(Error.ALREADY_EXIST_CODE, 'ALREADY_EXIST', detail);
    }

    static NOT_READY(detail = null) {
        return E(Error.NOT_READY_CODE, 'NOT_READY', detail);
    }

    static INVALID_REQUEST(detail = null) {
        return E(Error.INVALID_REQUEST_CODE, 'INVALID_REQUEST', detail);
    }

    static NOT_ALLOWED(detail = null) {
        return E(Error.NOT_ALLOWED_CODE, 'NOT_ALLOWED', detail);
    }

    static TOKEN_INVALID(detail = null) {
        return E(Error.TOKEN_INVALID_CODE, 'TOKEN_INVALID', detail);
    }

    // internal error
    static INTERNAL_ERROR({
        code = Error.INTERNAL_ERROR_CODE,
        message = 'INTERNAL_ERROR',
        detail = null
    }) {
        return E(code, message, detail);
    }
}


Error.NOT_AVAILABLE_CODE = 401;
Error.NOT_EXIST_CODE = 402;
Error.ALREADY_EXIST_CODE = 403;
Error.NOT_READY_CODE = 404;
Error.INVALID_REQUEST_CODE = 405;
Error.NOT_ALLOWED_CODE = 406;
Error.TOKEN_INVALID_CODE = 407;


// internl error
Error.INTERNAL_ERROR_CODE = 3000;


module.exports = Error;