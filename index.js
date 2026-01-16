require('dotenv').config();

const express = require('express');
const cors = require('cors');
const db = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const admin = require('./middleware/admin');
const auth = require('./middleware/auth');

const app = express();

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://ticketbox-frontend.vercel.app"
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// ===========================================
// === API XÁC THỰC (AUTH) ===
// ===========================================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const userExist = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userExist.rows.length > 0) {
      return res.status(400).json({ msg: "Email này đã được đăng ký!" });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = await db.query(
      "INSERT INTO users (email, password, role) VALUES ($1, $2, 'customer') RETURNING *",
      [email, hashedPassword]
    );
    res.status(201).json({ msg: "Đăng ký thành công!", user: newUser.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (user.rows.length === 0) {
      return res.status(401).json({ msg: "Email không tồn tại!" });
    }
    const validPassword = await bcrypt.compare(password, user.rows[0].password);
    if (!validPassword) {
      return res.status(401).json({ msg: "Mật khẩu không đúng!" });
    }
    const token = jwt.sign(
      { id: user.rows[0].id, role: user.rows[0].role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    res.json({
      msg: "Đăng nhập thành công!",
      token: token,
      user: {
        id: user.rows[0].id,
        email: user.rows[0].email,
        role: user.rows[0].role
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});


// ===========================================
// === API CHO CATEGORIES ===
// ===========================================

app.post('/api/categories', async (req, res) => {
  try {
    const { name } = req.body;
    const newCategory = await db.query(
      "INSERT INTO categories (name) VALUES ($1) RETURNING *",
      [name]
    );
    res.status(201).json(newCategory.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const allCategories = await db.query("SELECT * FROM categories ORDER BY id ASC");
    res.status(200).json(allCategories.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

app.get('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const category = await db.query(
      "SELECT * FROM categories WHERE id = $1",
      [id]
    );
    if (category.rows.length === 0) {
      return res.status(404).json({ msg: "Không tìm thấy danh mục" });
    }
    res.status(200).json(category.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

app.put('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const updatedCategory = await db.query(
      "UPDATE categories SET name = $1 WHERE id = $2 RETURNING *",
      [name, id]
    );
    if (updatedCategory.rows.length === 0) {
      return res.status(404).json({ msg: "Không tìm thấy danh mục" });
    }
    res.status(200).json(updatedCategory.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleteOp = await db.query(
      "DELETE FROM categories WHERE id = $1 RETURNING *",
      [id]
    );
    if (deleteOp.rows.length === 0) {
      return res.status(404).json({ msg: "Không tìm thấy danh mục" });
    }
    res.status(200).json({ msg: "Danh mục đã được xóa" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});


// ===========================================
// === API CHO EVENTS ===
// ===========================================

app.get('/api/events/featured', async (req, res) => {
  try {
    const featuredEvents = await db.query(
      `SELECT events.*, categories.name AS category_name 
       FROM events
       JOIN categories ON events.category_id = categories.id
       WHERE events.is_featured = TRUE 
       ORDER BY events.event_date DESC 
       LIMIT 6`
    );
    res.status(200).json(featuredEvents.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

app.get('/api/events/upcoming', async (req, res) => {
  try {
    const upcomingEvents = await db.query(
      `SELECT events.*, categories.name AS category_name 
       FROM events
       JOIN categories ON events.category_id = categories.id
       WHERE events.event_date > NOW()
       ORDER BY events.event_date ASC
       LIMIT 6`
    );
    res.status(200).json(upcomingEvents.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

app.get('/api/events', async (req, res) => {
  try {
    const { category_id } = req.query;

    let query = `
      SELECT 
        events.id, 
        events.title, 
        events.description, 
        events.image_url, 
        events.event_date, 
        events.end_date,  
        events.organizer, 
        events.location, 
        categories.name AS category_name,
        events.admin_id,
        events.category_id,
        events.is_featured
      FROM events
      JOIN categories ON events.category_id = categories.id
    `;

    const params = [];
    if (category_id) {
      query += ` WHERE events.category_id = $1`;
      params.push(category_id);
    }

    query += ` ORDER BY events.event_date DESC`;

    const allEvents = await db.query(query, params);
    res.status(200).json(allEvents.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

app.post('/api/events', auth, admin, async (req, res) => {
  try {
    console.log("Đang nhận yêu cầu tạo sự kiện:", req.body);
    const { title, description, image_url, event_date, end_date, location, category_id, organizer, is_featured } = req.body;
    if (!req.user || !req.user.id) {
      return res.status(401).json({ msg: "Lỗi xác thực: Không tìm thấy User ID" });
    }
    const admin_id = req.user.id;
    if (!title || !event_date || !location) {
      console.log("Thiếu thông tin bắt buộc (title, event_date, location)");
      return res.status(400).json({ msg: "Thiếu tên, ngày hoặc địa điểm!" });
    }
    const newEvent = await db.query(
      `INSERT INTO events (title, description, image_url, event_date, end_date, location, category_id, organizer, is_featured, admin_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       RETURNING *`,
      [title, description, image_url, event_date, end_date, location, category_id, organizer, is_featured, admin_id]
    );
    if (newEvent.rows.length > 0) {
      console.log("Tạo sự kiện thành công, ID:", newEvent.rows[0].id);
      res.status(201).json(newEvent.rows[0]);
    } else {
      throw new Error("Không thể lưu sự kiện vào database (Không có dòng nào được trả về)");
    }

  } catch (err) {
    console.error("LỖI TẠO SỰ KIỆN (BACKEND):", err);
    res.status(500).send("Lỗi Server: " + err.message);
  }
});

app.get('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const event = await db.query(`
      SELECT 
        events.id, 
        events.title, 
        events.description, 
        events.image_url, 
        events.event_date,
        events.end_date,
        events.organizer,
        events.location, 
        categories.name AS category_name,
        events.admin_id,
        events.category_id
      FROM events
      JOIN categories ON events.category_id = categories.id
      WHERE events.id = $1
    `, [id]);
    if (event.rows.length === 0) {
      return res.status(404).json({ msg: "Không tìm thấy sự kiện" });
    }
    res.status(200).json(event.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

app.put('/api/events/:id', auth, admin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, image_url, event_date, end_date, location, category_id, organizer, is_featured } = req.body;
    if (!title || !event_date || !location) {
      return res.status(400).json({ msg: "Thiếu thông tin bắt buộc (Tên, Ngày, Địa điểm)!" });
    }

    const updatedEvent = await db.query(
      `UPDATE events 
       SET title = $1, 
           description = $2, 
           image_url = $3, 
           event_date = $4, 
           end_date = $5, 
           location = $6, 
           category_id = $7, 
           organizer = $8, 
           is_featured = $9
       WHERE id = $10 
       RETURNING *`,
      [title, description, image_url, event_date, end_date, location, category_id, organizer, is_featured || false, id]
    );

    if (updatedEvent.rows.length === 0) {
      return res.status(404).json({ msg: "Không tìm thấy sự kiện cần sửa" });
    }

    console.log(`Đã cập nhật sự kiện ID ${id}`);
    res.status(200).json(updatedEvent.rows[0]);

  } catch (err) {
    console.error("LỖI SỬA SỰ KIỆN:", err.message);
    res.status(500).send("Lỗi Server: " + err.message);
  }
});

/*app.put('/api/events/:id', auth, admin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, image_url, event_date, location, category_id } = req.body;
    
    const updatedEvent = await db.query(
      `UPDATE events 
       SET title = $1, description = $2, image_url = $3, event_date = $4, location = $5, category_id = $6
       WHERE id = $7 
       RETURNING *`,
      [title, description, image_url, event_date, location, category_id, id]
    );

    if (updatedEvent.rows.length === 0) {
      return res.status(404).json({ msg: "Không tìm thấy sự kiện" });
    }
    res.status(200).json(updatedEvent.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});
*/

app.delete('/api/events/:id', auth, admin, async (req, res) => {
  try {
    const { id } = req.params;

    await db.query("DELETE FROM tickets WHERE event_id = $1", [id]);
    const deleteOp = await db.query(
      "DELETE FROM events WHERE id = $1 RETURNING *",
      [id]
    );

    if (deleteOp.rows.length === 0) {
      return res.status(404).json({ msg: "Không tìm thấy sự kiện" });
    }
    res.status(200).json({ msg: "Sự kiện đã được xóa" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// ===========================================
// === API CHO TICKETS ===
// ===========================================

app.get('/api/tickets/:event_id', async (req, res) => {
  try {
    const { event_id } = req.params;
    const tickets = await db.query(
      "SELECT * FROM tickets WHERE event_id = $1 ORDER BY price ASC",
      [event_id]
    );
    res.status(200).json(tickets.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

app.post('/api/tickets', auth, admin, async (req, res) => {
  try {
    const { event_id, type, price, quantity_available } = req.body;

    const newTicket = await db.query(
      "INSERT INTO tickets (event_id, type, price, quantity_available) VALUES ($1, $2, $3, $4) RETURNING *",
      [event_id, type, price, quantity_available]
    );

    res.status(201).json(newTicket.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// ===========================================
// === API CHO ORDERS (ĐƠN HÀNG) ===
// ===========================================

/**
 * @route   GET /api/orders/mine
 * @desc    Lấy danh sách vé đã mua của người dùng hiện tại (MỚI THÊM)
 * @access  Private (Cần đăng nhập)
 */
app.get('/api/orders/mine', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT 
        o.id as order_id, 
        o.order_date,
        e.title as event_title,
        e.event_date,
        e.location,
        e.image_url,
        t.type as ticket_type,
        t.price,
        oi.quantity_ordered as quantity
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN tickets t ON oi.ticket_id = t.id
      JOIN events e ON t.event_id = e.id
      WHERE o.user_id = $1
      ORDER BY o.order_date DESC;
    `;

    const result = await db.query(query, [userId]);
    res.json(result.rows);

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Lỗi Server');
  }
});

/**
 * @route   POST /api/orders
 * @desc    Tạo đơn hàng mới (Mua vé) - CÓ GIỚI HẠN SỐ LƯỢNG MUA CỦA USER
 * @access  Private (Cần đăng nhập)
 */
app.post('/api/orders', auth, async (req, res) => {
  const client = await db.pool.connect();

  try {
    const { ticket_id, quantity } = req.body;
    const user_id = req.user.id;

    const MAX_TICKET_PER_USER = 2; // Ví dụ: Mỗi người chỉ được mua tối đa 4 vé trọn đời cho loại này

    await client.query('BEGIN');

    const historyQuery = `
      SELECT SUM(oi.quantity_ordered) as total_bought
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.user_id = $1 AND oi.ticket_id = $2
    `;
    const historyRes = await client.query(historyQuery, [user_id, ticket_id]);
    const currentBought = parseInt(historyRes.rows[0].total_bought) || 0;

    if (currentBought + quantity > MAX_TICKET_PER_USER) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        msg: `Bạn đã mua ${currentBought} vé trước đó. Giới hạn tối đa là ${MAX_TICKET_PER_USER} vé/người.`
      });
    }

    const ticketRes = await client.query(
      "SELECT * FROM tickets WHERE id = $1 FOR UPDATE",
      [ticket_id]
    );

    if (ticketRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ msg: "Vé không tồn tại!" });
    }

    const ticket = ticketRes.rows[0];

    if (ticket.quantity_available < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ msg: "Không đủ số lượng vé trong kho!" });
    }
    await client.query(
      "UPDATE tickets SET quantity_available = quantity_available - $1 WHERE id = $2",
      [quantity, ticket_id]
    );
    const orderRes = await client.query(
      "INSERT INTO orders (user_id, status) VALUES ($1, 'completed') RETURNING id",
      [user_id]
    );
    const order_id = orderRes.rows[0].id;
    await client.query(
      "INSERT INTO order_items (order_id, ticket_id, quantity_ordered, price_at_purchase) VALUES ($1, $2, $3, $4)",
      [order_id, ticket_id, quantity, ticket.price]
    );

    await client.query('COMMIT');

    res.status(201).json({ msg: "Đặt vé thành công!", order_id: order_id });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).send("Lỗi Server khi đặt vé");
  } finally {
    client.release();
  }
});
app.get('/', (req, res) => {
  res.send('Chào mừng đến với Backend API Ticketbox!');
});
const PORT = process.env.PORT || 5000;

app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.status(200).json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ status: "db_error", error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
