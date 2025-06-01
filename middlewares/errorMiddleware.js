module.exports = (err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(err.status || 500).render("error", {
    message: err.message || "Something went wrong!",
  });
};