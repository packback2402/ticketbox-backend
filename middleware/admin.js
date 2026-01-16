module.exports = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      msg: "Truy cập bị từ chối! Chỉ Admin mới được phép."
    });
  }
  next();
};
