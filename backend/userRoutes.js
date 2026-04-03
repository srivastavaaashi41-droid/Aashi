const express = require("express");
const router = express.Router();
const db = require("./db");

// ================= USER SIGNUP =================
router.post("/signup", (req, res) => {
  const { name, email, password, role } = req.body;

  if (password.length < 5) {
    return res.status(400).send("⚠ Password must be at least 5 characters!");
  }

  // Collector signup
  if (role === "collector") {
    db.query("SELECT * FROM collectors WHERE email=?", [email], (err, result) => {
      if (result.length > 0) return res.status(400).send("⚠ Collector already exists!");

      db.query(
        "INSERT INTO collectors (name, email, password) VALUES (?, ?, ?)",
        [name, email, password],
        (err) => {
          if (err) return res.status(500).send("Signup failed.");
          return res.send("✅ Collector Account Created!");
        }
      );
    });

  } 
  else {
    // User signup
    db.query("SELECT * FROM users WHERE email=?", [email], (err, result) => {
      if (result.length > 0) return res.status(400).send("⚠ User already exists!");

      db.query(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
        [name, email, password, role],
        (err) => {
          if (err) return res.status(500).send("Signup failed.");
          return res.send("✅ User Account Created!");
        }
      );
    });
  }
});


// ================= LOGIN FOR ADMIN + USER + COLLECTOR =================
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  // 1️⃣ ADMIN LOGIN
  db.query("SELECT * FROM admins WHERE email=? AND password=?", [email, password], (err, adminResult) => {
    if (adminResult.length > 0) {
      return res.json({ success: true, role: "admin", email });
    }

    // 2️⃣ USER LOGIN
    db.query("SELECT id, name, email, role FROM users WHERE email=? AND password=?", [email, password], (err, userResult) => {
      if (userResult.length > 0) {
        return res.json({ success: true, role: userResult[0].role, email });
      }

      // 3️⃣ COLLECTOR LOGIN
      db.query("SELECT * FROM collectors WHERE email=? AND password=?", [email, password], (err, colResult) => {
        if (colResult.length > 0) {
          return res.json({ success: true, role: "collector", email });
        }

        return res.status(401).json({ success: false, message: "Invalid Credentials" });
      });
    });
  });
});


// ================= USER CREATE REQUEST =================
router.post("/request", (req, res) => {
  const { user_email, location } = req.body;

  db.query(
    "INSERT INTO requests (user_email, location) VALUES (?, ?)",
    [user_email, location],
    (err, result) => {
      if (err) return res.status(500).send("Request failed");
      res.json({ request_id: result.insertId });
    }
  );
});


// ================= USER TRACK REQUEST =================
router.get("/track/:id", (req, res) => {
  db.query("SELECT * FROM requests WHERE id=?", [req.params.id], (err, rows) => {
    if (rows.length === 0) return res.status(404).send("No request found");
    res.json(rows[0]);
  });
});


// ================= ADMIN VIEW ALL REQUESTS =================
router.get("/admin/requests", (req, res) => {
  db.query("SELECT * FROM requests ORDER BY id DESC", (err, rows) => {
    if (err) return res.status(500).send("Error fetching data");
    res.json(rows);
  });
});


// ================= ADMIN VIEW ONLY PENDING =================
router.get("/admin/pending", (req, res) => {
  db.query("SELECT * FROM requests WHERE status='Pending' ORDER BY id DESC", (err, rows) => {
    if (err) return res.status(500).send(err);
    res.json(rows);
  });
});


// ================= ADMIN ASSIGN COLLECTOR =================
router.post("/admin/assign", (req, res) => {
  const { request_id, collector } = req.body;
  
  db.query(
    "UPDATE requests SET status='Assigned', collector=? WHERE id=?",
    [collector, request_id],
    (err) => {
      if (err) return res.status(500).send("Assignment error");
      res.send("✅ Collector Assigned!");
    }
  );
});
router.post("/admin/save-salary-msg", (req, res) => {
  const { email, message } = req.body;

  db.query(
    "UPDATE collectors SET notification=? WHERE email=?",
    [message, email],
    (err) => {
      if (err) return res.status(500).send("Error saving message");
      res.send("Message Saved");
    }
  );
});


// ================= COLLECTOR VIEW THEIR REQUESTS =================
router.get("/collector/:email", (req, res) => {
  const email = req.params.email;

  db.query(
    `SELECT id, user_email, location, status 
     FROM requests 
     WHERE collector=? 
     ORDER BY id DESC`,    
    [email],
    (err, rows) => {
      if (err) return res.status(500).send(err);

      res.json(rows);
    }
  );
});

// ================= COLLECTOR COMPLETE REQUEST =================
router.post("/collector/complete", (req, res) => {
  const { request_id, collector_email } = req.body;

  db.query(
    "UPDATE requests SET status='Collected', completed_at=NOW() WHERE id=?",
    [request_id],
    (err1) => {
      if (err1) return res.status(500).json({ error: err1 });
      return res.json({ message: "✅ Marked as Collected!" });
    }
  );
});



// ================= COLLECTOR SUMMARY =================
router.get("/collector/summary/:email", (req, res) => {
  const email = req.params.email;

  const q = `
    SELECT
      SUM(CASE WHEN status='Collected' THEN 1 ELSE 0 END) AS collected,
      SUM(CASE WHEN status='Assigned' THEN 1 ELSE 0 END) AS assigned,
      SUM(CASE WHEN status='Pending' THEN 1 ELSE 0 END) AS pending
    FROM requests
    WHERE collector=?`;

  db.query(q, [email], (err, rows) => {
    if (err) return res.status(500).send(err);

    res.json({
      collected: rows[0].collected || 0,
      assigned: rows[0].assigned || 0,
      pending: rows[0].pending || 0
    });
  });
});
router.get("/collector/notification/:email", (req, res) => {
  db.query(
    "SELECT notification FROM collectors WHERE email=?",
    [req.params.email],
    (err, rows) => {
      if (err) return res.status(500).send("Error");
      res.json(rows[0]);
    }
  );
});


// ================= ADMIN REMOVE ASSIGN =================
router.post("/admin/remove", (req, res) => {
  db.query("UPDATE requests SET status='Pending', collector=NULL WHERE id=?", [req.body.request_id], (err) => {
    if (err) return res.status(500).send("Remove failed");
    res.send("Removed");
  });
});


// ================= ADMIN FETCH COLLECTORS =================
router.get("/collectors", (req, res) => {
  db.query("SELECT name, email FROM collectors", (err, rows) => {
    res.json(rows);
  });
});


// ================= USER VIEW OWN REQUESTS =================
router.get("/user/requests/:email", (req, res) => {
  const email = req.params.email;
  db.query(
    "SELECT * FROM requests WHERE user_email=? ORDER BY id DESC",
    [email],
    (err, rows) => {
      if (err) return res.status(500).send("Error loading requests");
      res.json(rows);
    }
  );
});
// ================= ADMIN ASSIGN SALARY =================
router.post("/admin/salary", (req, res) => {
  const { collector_email, amount, month } = req.body;

  db.query(
    "INSERT INTO collector_salaries (collector_email, salary_amount, salary_month) VALUES (?, ?, ?)",
    [collector_email, amount, month],
    (err) => {
      if (err) return res.status(500).send("Salary assign failed");
      res.send("✅ Salary Assigned!");
    }
  );
});

module.exports = router;
