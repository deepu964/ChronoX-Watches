module.exports = (err, req, res, next) => {
  console.error("Error:", err.message);

  const status = err.status || err.statusCode || 500;

  res.status(status).render("error", {
    message: err.message || "Something went wrong!",
    status: status,
  });
};