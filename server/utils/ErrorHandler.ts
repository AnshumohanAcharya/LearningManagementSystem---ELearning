class ErrorHandler extends Error {
  statusCode: Number;
  message: any;
  constructor(statusCode: Number, message: any) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default ErrorHandler;
