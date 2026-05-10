// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode ?? 500;
  const message = err.isOperational ? err.message : "Internal server error.";

  if (!err.isOperational) {
    console.error("[Unhandled Error]", err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}
