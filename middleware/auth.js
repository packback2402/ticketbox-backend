const jwt = require("jsonwebtoken");

const auth = (req, res, next) => {
  try {
    // Authorization: Bearer <token>
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ msg: "Không có token hoặc token sai định dạng!" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    next();
  } catch (err) {
    console.error("JWT ERROR:", err.message);
    return res.status(401).json({ msg: "Token không hợp lệ hoặc đã hết hạn!" });
  }
};

module.exports = auth;
