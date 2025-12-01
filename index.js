import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import flash from "connect-flash";
import { connect, sql } from "./db.js";

const app = express();
const PORT = 3000;

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: "your-secret", resave: false, saveUninitialized: true }));
app.use(flash());
app.use(express.json());

// Route untuk halaman utama (login) DONE
app.get("/", (req, res) => {
  res.render("index.ejs", { error: req.flash("error").length > 0 });
});

// Route untuk logout DONE
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.send("Logout failed");
    }
    res.redirect("/");
  });
});

// Tangani POST dari form login DONE
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  // Lakukan proses validasi/autentikasi di sini
  if (username === "owner" && password === "password123") {
    //res.send('Login berhasil!');
    res.redirect("/owner/dashboard");
  } else if (username === "owner" && password !== "password123") {
    req.flash("error", true);
    res.redirect("/");
  } else {
    try {
      const pool = await connect();

      const result = await pool.request().input("username", sql.NVarChar, username).query("SELECT id_asisten, nama_asisten, password FROM Asisten WHERE nama_asisten = @username");

      if (result.recordset.length == 0) {
        req.flash("error", true);
        res.redirect("/");
      } else {
        if (result.recordset[0].password == password) {
          req.session.assistantName = username;
          req.session.idAsisten = result.recordset[0].id_asisten;
          res.redirect("/assistant/dashboard");
        } else {
          res.render("index.ejs", { error: true });
        }
      }
    } catch (err) {
      console.log(err.message);
    }
  }
});

// ------------------------ ASSISTANT INTERFACE -------------------------
// ROUTING
// Route untuk halaman dashboard client DONE
app.get("/assistant/dashboard", (req, res) => {
  res.render("dashboardass.ejs", {
    title: "Dashboard Assistant",
    name: req.session.assistantName,
    active: 1,
  });
});

// Route untuk halaman manage client DONE
app.get("/assistant/mngclient", async (req, res) => {
  const statusMessages = req.flash("status");
  const status = statusMessages.length > 0 ? statusMessages[0] : null;
  const perPage = 7;
  const page = parseInt(req.query.page) || 1;
  const search = req.query.search || ""; // ambil keyword dari URL

  try {
    const pool = await connect();

    const result = await pool.request().input("search", sql.VarChar, search).query("SELECT * FROM Klien WHERE is_active = 1 AND nama LIKE '%' + @search + '%'");

    const totalItems = result.recordset.length;
    const start = (page - 1) * perPage;
    const totalPages = Math.ceil(totalItems / perPage);

    const paginated = result.recordset.slice(start, start + perPage);

    res.render("layout-client.ejs", {
      title: "Manage Client",
      heading: "Client List",
      columns: ["Edit", "Name", "Address", "Contact"],
      clients: paginated,
      active: 2,
      currentPage: page,
      totalPages: totalPages,
      status: status,
    });
  } catch (err) {
    console.log(err.message);
  }
});

// Route untuk halaman add client DONE
app.get("/assistant/mngclient/add-client", (req, res) => {
  res.render("layout-add.ejs", {
    title: "Add Client",
    heading: "Add Client",
    formAction: "/assistant/mngclient/add-client",
    fields: [
      { label: "Client Name", name: "clientName", placeholder: "name..." },
      { label: "Client Address", name: "clientAddress", placeholder: "address..." },
      { label: "Client Contact", name: "clientContact", placeholder: "contact..." },
    ],
    active: 2,
    mode: "add",
  });
});

// Route untuk halaman edit client DONE
app.get("/assistant/mngclient/edit-client/:id", async (req, res) => {
  const id = req.params.id;

  const pool = await connect();
  const result = await pool.request().input("id", sql.Int, id).query("SELECT * FROM Klien WHERE id_klien = @id");

  res.render("layout-add.ejs", {
    title: "Edit Client",
    heading: "Edit Client",
    formAction: "/assistant/mngclient/edit-client/" + id,
    formDeleteAction: "/assistant/mngclient/delete-client/" + id,
    fields: [
      { label: "Client Name", name: "clientName", placeholder: "name...", value: result.recordset[0].nama },
      { label: "Client Address", name: "clientAddress", placeholder: "address...", value: result.recordset[0].alamat },
      { label: "Client Contact", name: "clientContact", placeholder: "contact...", value: result.recordset[0].kontak },
    ],
    active: 2,
    mode: "edit",
    id: id,
  });
});

// Route untuk halaman manage event DONE
app.get("/assistant/mngevent", async (req, res) => {
  const assistant = req.session.assistantName;

  const statusMessages = req.flash("status");
  const status = statusMessages.length > 0 ? statusMessages[0] : null;
  const perPage = 7;
  const page = parseInt(req.query.page) || 1;
  const search = req.query.search || ""; // ambil keyword dari URL

  try {
    const pool = await connect();

    const result = await pool
      .request()
      .input("search", sql.VarChar, `%${search}%`)
      .input("id_asisten", sql.Int, req.session.idAsisten)
      .query(
        "SELECT Event.id_event, Klien.nama, CONVERT(VARCHAR, Event.tanggal, 23) AS tanggal, Event.Status FROM (SELECT * FROM MenyelenggarakanEvent WHERE id_asisten = @id_asisten) AS t2 INNER JOIN Event ON t2.id_event = Event.id_event INNER JOIN Klien ON t2.id_klien = Klien.id_klien WHERE Klien.nama LIKE @search AND Event.is_active = 1 ORDER BY Event.status DESC"
      );

    const totalItems = result.recordset.length;
    const start = (page - 1) * perPage;
    const totalPages = Math.ceil(totalItems / perPage);

    const paginated = result.recordset.slice(start, start + perPage);

    res.render("layout-event.ejs", {
      title: "Event List",
      heading: assistant + "'s Event List",
      columns: ["Edit", "Client", "Date", "Status", ""],
      events: paginated,
      active: 3,
      currentPage: page,
      totalPages: totalPages,
      status: status,
    });
  } catch (err) {
    console.log(err.message);
  }
});

// Route untuk halaman add event DONE
app.get("/assistant/mngevent/add-event", async (req, res) => {
  try {
    const pool = await connect();

    const result = await pool.request().query("SELECT * FROM JenisEvent");
    const result2 = await pool.request().query("SELECT id_klien, nama FROM Klien WHERE is_active = 1");

    res.render("layout-add.ejs", {
      title: "Add Event",
      heading: "Add Event",
      formAction: "/assistant/mngevent/add-event",
      fields: [
        { label: "Client Name", name: "clientID", type: "autocomplete", placeholder: "client name...", options: result2.recordset },
        { label: "Invitation Amount", name: "invAmount", placeholder: "invitation amount..." },
        { label: "Event Date", name: "eventDate", placeholder: "YYYY-MM-DD" },
        {
          label: "Event Status",
          name: "eventStatus",
          type: "select",
          options: ["Not Started", "On Process", "Finished"],
        },
        {
          label: "Event Type",
          name: "eventType",
          type: "select",
          options: result.recordset,
        },
      ],
      active: 3,
      mode: "add",
    });
  } catch (err) {
    console.log(err.message);
  }
});

// Route untuk halaman edit event DONE
app.get("/assistant/mngevent/edit-event/:idEvent", async (req, res) => {
  try {
    const pool = await connect();

    const result = await pool.request().query("SELECT * FROM JenisEvent");
    const result2 = await pool.request().query("SELECT id_klien, nama FROM Klien WHERE is_active = 1");
    const result3 = await pool
      .request()
      .input("idEvent", sql.Int, req.params.idEvent)
      .query(
        "SELECT Klien.nama, t2.jumlah_undangan, CONVERT(VARCHAR, t2.tanggal, 23) AS tanggal, t2.status, JenisEvent.nama_jenis FROM (SELECT * FROM Event WHERE id_event = @idEvent) AS t2 INNER JOIN JenisEvent ON t2.id_jenis = JenisEvent.id_jenis INNER JOIN MenyelenggarakanEvent ON t2.id_event = MenyelenggarakanEvent.id_event INNER JOIN Klien ON MenyelenggarakanEvent.id_klien = Klien.id_klien"
      );

    res.render("layout-add.ejs", {
      title: "Edit Event",
      heading: "Edit Event",
      formAction: "/assistant/mngevent/edit-event/" + req.params.idEvent,
      formDeleteAction: "/assistant/mngevent/delete-event/" + req.params.idEvent,
      fields: [
        { label: "Client Name", name: "clientID", type: "autocomplete", placeholder: "client name...", options: result2.recordset, value: result3.recordset[0].nama },
        { label: "Invitation Amount", name: "invAmount", placeholder: "invitation amount...", value: result3.recordset[0].jumlah_undangan },
        { label: "Event Date", name: "eventDate", placeholder: "YYYY-MM-DD", value: result3.recordset[0].tanggal },
        {
          label: "Event Status",
          name: "eventStatus",
          type: "select",
          options: ["Not Started", "On Process", "Finished"],
          value: result3.recordset[0].status,
        },
        {
          label: "Event Type",
          name: "eventType",
          type: "select",
          options: result.recordset,
          value: result3.recordset[0].nama_jenis,
        },
      ],
      active: 3,
      mode: "edit",
      id: req.params.idEvent,
    });
  } catch (err) {
    console.log(err.message);
  }
});

// Route untuk halaman detail event DONE
app.get("/assistant/mngevent/detail/:id", async (req, res) => {
  const statusMessages = req.flash("status");
  const status = statusMessages.length > 0 ? statusMessages[0] : null;
  const perPage = 7;
  const page = parseInt(req.query.page) || 1;

  try {
    const pool = await connect();

    const result = await pool
      .request()
      .input("idEvent", sql.Int, req.params.id)
      .query(
        "SELECT Vendor.id_vendor, Vendor.nama_vendor, KategoriVendor.nama_kategori, EventVendor.harga_dealing, Vendor.harga_min, Vendor.harga_max FROM (SELECT * FROM Event WHERE id_event = @idEvent) AS e INNER JOIN EventVendor ON EventVendor.id_event = e.id_event INNER JOIN Vendor ON EventVendor.id_vendor = Vendor.id_vendor INNER JOIN KategoriVendor ON KategoriVendor.id_kategori = Vendor.id_kategori"
      );

    const totalItems = result.recordset.length;
    const start = (page - 1) * perPage;
    const totalPages = Math.ceil(totalItems / perPage);

    const paginated = result.recordset.slice(start, start + perPage);

    const totalFix = await pool
      .request()
      .input("idEvent", sql.Int, req.params.id)
      .query("SELECT SUM(EventVendor.harga_dealing) AS 'TotalFix' FROM(SELECT * FROM Event WHERE id_event = @idEvent) AS e INNER JOIN EventVendor ON EventVendor.id_event = e.id_event");

    const heading = await pool
      .request()
      .input("idEvent", sql.Int, req.params.id)
      .query(
        "SELECT Klien.nama, JenisEvent.nama_jenis FROM (SELECT * FROM Event WHERE id_event = @idEvent) AS e INNER JOIN MenyelenggarakanEvent ON e.id_event = MenyelenggarakanEvent.id_event INNER JOIN JenisEvent ON e.id_jenis = JenisEvent.id_jenis INNER JOIN Klien ON MenyelenggarakanEvent.id_klien = Klien.id_klien"
      );

    res.render("detail-event.ejs", {
      title: "Event - Vendor Detail",
      heading: heading.recordset[0].nama + "'s " + heading.recordset[0].nama_jenis,
      columns: ["Vendor", "Type", "Price", "Status"],
      vendors: paginated,
      active: 3,
      status: status,
      currentPage: page,
      totalPages: totalPages,
      status: status,
      totalFix: totalFix.recordset[0].TotalFix,
      idEvent: req.params.id,
    });
  } catch (err) {
    console.log(err.message);
  }
});

// Route untuk halaman detail event - add vendor untuk suatu event (kurang tambahin kategori utk tiap vendor)
app.get("/assistant/mngevent/detail/add-vendor/:idEvent", async (req, res) => {
  try {
    const pool = await connect();

    const result = await pool.request().query("SELECT id_vendor, nama_vendor FROM Vendor");

    res.render("addEventVendor.ejs", {
      title: "Add new Vendor",
      active: 3,
      vendors: result.recordset,
      idEvent: req.params.idEvent,
    });
  } catch (err) {
    console.log(err.message);
  }
});

// Route untuk halaman detail event - edit vendor untuk suatu event DONE
app.get("/assistant/mngevent/detail/edit-vendor/:idEvent/:idVendor", async (req, res) => {
  try {
    const pool = await connect();

    const result = await pool.request().input("idEvent", sql.Int, req.params.idEvent).input("idVendor", sql.Int, req.params.idVendor).query("SELECT harga_dealing FROM EventVendor WHERE id_event = @idEvent AND id_vendor = @idVendor");

    res.render("editEventVendor.ejs", {
      idEvent: req.params.idEvent,
      idVendor: req.params.idVendor,
      title: "Edit Vendor",
      active: 3,
      isFix: result.recordset[0].harga_dealing != null,
      hargaDealing: result.recordset[0].harga_dealing,
    });
  } catch (err) {
    console.log(err.message);
  }
});

// POST HANDLING
// POST dari form add client DONE
app.post("/assistant/mngclient/add-client", async (req, res) => {
  const { clientName, clientAddress, clientContact } = req.body;

  try {
    const pool = await connect();

    const result = await pool
      .request()
      .input("clientName", sql.NVarChar, clientName)
      .input("clientAddress", sql.NVarChar, clientAddress)
      .input("clientContact", sql.NVarChar, clientContact)
      .query("INSERT INTO Klien(nama, alamat, kontak) VALUES(@clientName, @clientAddress, @clientContact)");

    if (result.rowsAffected[0] == 1) {
      req.flash("status", "Client Successfully Added!");
      res.redirect("/assistant/mngclient");
    }
  } catch (err) {
    req.flash("status", "Client Cannot Be Added!");
    res.redirect("/assistant/mngclient");
    console.log(err.message);
  }
});

// POST dari form edit client DONE
app.post("/assistant/mngclient/edit-client/:id", async (req, res) => {
  const { clientName, clientAddress, clientContact } = req.body;
  const id = req.params.id;

  try {
    const pool = await connect();

    const result = await pool
      .request()
      .input("clientName", sql.NVarChar, clientName)
      .input("clientAddress", sql.NVarChar, clientAddress)
      .input("clientContact", sql.NVarChar, clientContact)
      .input("id", sql.Int, id)
      .query("UPDATE Klien SET nama = @clientName, alamat = @clientAddress, kontak = @clientContact WHERE id_klien = @id");

    if (result.rowsAffected[0] == 1) {
      req.flash("status", "Client Successfully Updated!");
      res.redirect("/assistant/mngclient");
    }
  } catch (err) {
    req.flash("status", "Client Cannot Be Updated!");
    res.redirect("/assistant/mngclient");
    console.log(err.message);
  }
});

// POST dari form edit - delete client DONE
app.post("/assistant/mngclient/delete-client/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const pool = await connect();

    const result = await pool.request().input("id", sql.Int, id).query("UPDATE Klien SET is_active = 0 WHERE id_klien = @id");

    if (result.rowsAffected[0] == 1) {
      req.flash("status", "Client Successfully Deleted!");
      res.redirect("/assistant/mngclient");
    }
  } catch (err) {
    req.flash("status", "Client Cannot Be Deleted!");
    res.redirect("/assistant/mngclient");
    console.log(err.message);
  }
});

// POST dari form add event DONE
app.post("/assistant/mngevent/add-event", async (req, res) => {
  const { clientID, invAmount, eventDate, eventStatus, eventType } = req.body;
  const idAsisten = req.session.idAsisten;

  try {
    const pool = await connect();

    const result = await pool
      .request()
      .input("invAmount", sql.Int, invAmount)
      .input("eventDate", sql.Date, eventDate)
      .input("eventStatus", sql.NVarChar, eventStatus)
      .input("eventType", sql.Int, eventType)
      .query("INSERT INTO Event(tanggal, jumlah_undangan, status, id_jenis) VALUES(@eventDate, @invAmount, @eventStatus, @eventType)");

    const idEvent = await pool.request().query("SELECT MAX(id_event) AS max FROM Event");

    console.log(idEvent);

    const result2 = await pool
      .request()
      .input("idEvent", sql.Int, idEvent.recordset[0].max)
      .input("idKlien", sql.Int, clientID)
      .input("idAsisten", sql.Int, idAsisten)
      .query("INSERT INTO MenyelenggarakanEvent(id_event, id_klien, id_asisten) VALUES(@idEvent, @idKlien, @idAsisten)");

    if (result.rowsAffected[0] == 1 && result2.rowsAffected[0] == 1) {
      req.flash("status", "Event Successfully Added!");
      res.redirect("/assistant/mngevent");
    }
  } catch (err) {
    req.flash("status", "Event Cannot Be Added!");
    res.redirect("/assistant/mngevent");
    console.log(err.message);
  }
});

// POST dari form edit event DONE
app.post("/assistant/mngevent/edit-event/:id", async (req, res) => {
  const { clientID, invAmount, eventDate, eventStatus, eventType } = req.body;
  const id = req.params.id;

  console.log(req.body);

  try {
    const pool = await connect();

    const result = await pool
      .request()
      .input("idEvent", sql.Int, id)
      .input("invAmount", sql.Int, invAmount)
      .input("eventDate", sql.Date, eventDate)
      .input("eventStatus", sql.NVarChar, eventStatus)
      .input("eventType", sql.Int, eventType)
      .query("UPDATE Event SET tanggal = @eventDate, jumlah_undangan = @invAmount, status = @eventStatus, id_jenis = @eventType WHERE id_event = @idEvent");

    const result2 = await pool.request().input("idEvent", sql.Int, id).input("idKlien", sql.Int, clientID).query("UPDATE MenyelenggarakanEvent SET id_klien = @idKlien WHERE id_event = @idEvent");

    if (result.rowsAffected[0] == 1 && result2.rowsAffected[0] == 1) {
      req.flash("status", "Event Successfully Updated!");
      res.redirect("/assistant/mngevent");
    }
  } catch (err) {
    req.flash("status", "Event Cannot Be Updated!");
    res.redirect("/assistant/mngevent");
    console.log(err.message);
  }
});

// POST dari form edit - delete event DONE
app.post("/assistant/mngevent/delete-event/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const pool = await connect();

    const result = await pool.request().input("id", sql.Int, id).query("UPDATE Event SET is_active = 0 WHERE id_event = @id");

    if (result.rowsAffected[0] == 1) {
      req.flash("status", "Event Successfully Deleted!");
      res.redirect("/assistant/mngevent");
    }
  } catch (err) {
    req.flash("status", "Event Cannot Be Deleted!");
    res.redirect("/assistant/mngevent");
    console.log(err.message);
  }
});

// POST dari halaman detail event - add vendor untuk suatu event DONE
app.post("/assistant/mngevent/detail/add-vendor/:idEvent", async (req, res) => {
  const idEvent = req.params.idEvent;
  const idVendor = req.body.vendorId;

  try {
    const pool = await connect();

    const result = await pool.request().input("idEvent", sql.Int, idEvent).input("idVendor", sql.Int, idVendor).query("INSERT INTO EventVendor(id_event, id_vendor) VALUES(@idEvent, @idVendor)");

    if (result.rowsAffected[0] == 1) {
      req.flash("status", "Vendor Successfully Added!");
      res.redirect("/assistant/mngevent/detail/" + idEvent);
    }
  } catch (err) {
    req.flash("status", "Vendor Cannot Be Added!");
    res.redirect("/assistant/mngevent/detail/" + idEvent);
    console.log(err.message);
  }
});

// POST dari halaman manage event - edit - delete event DONE
app.post("/assistant/mngevent/delete-event/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const pool = await connect();

    const result = await pool.request().input("id", sql.Int, id).query("UPDATE Event SET is_active = 0 WHERE id_event = @id");

    if (result.rowsAffected[0] == 1) {
      req.flash("status", "Event Successfully Deleted!");
      res.redirect("/assistant/mngevent");
    }
  } catch (err) {
    req.flash("status", "Event Cannot Be Deleted!");
    res.redirect("/assistant/mngevent");
    console.log(err.message);
  }
});

// POST dari halaman detail event - edit vendor untuk suatu event DONE
app.post("/assistant/mngevent/detail/edit-vendor/:idEvent/:idVendor", async (req, res) => {
  const idEvent = req.params.idEvent;
  const idVendor = req.params.idVendor;
  const { priceStatus, price } = req.body;

  if (priceStatus == "Fix") {
    try {
      const pool = await connect();

      const result = await pool
        .request()
        .input("idEvent", sql.Int, idEvent)
        .input("idVendor", sql.Int, idVendor)
        .input("price", sql.Int, price)
        .query("UPDATE EventVendor SET harga_dealing = @price WHERE id_event = @idEvent AND id_vendor = @idVendor");

      if (result.rowsAffected[0] == 1) {
        req.flash("status", "Vendor Dealing Price Successfully Updated!");
        res.redirect("/assistant/mngevent/detail/" + idEvent);
      }
    } catch (err) {
      req.flash("status", "Vendor Dealing Price Cannot Be Updated!");
      res.redirect("/assistant/mngevent/detail/" + idEvent);
      console.log(err.message);
    }
  } else {
    try {
      const pool = await connect();

      const result = await pool.request().input("idEvent", sql.Int, idEvent).input("idVendor", sql.Int, idVendor).query("UPDATE EventVendor SET harga_dealing = null WHERE id_event = @idEvent AND id_vendor = @idVendor");

      if (result.rowsAffected[0] == 1) {
        req.flash("status", "Vendor Price Successfully Updated to Estimation!");
        res.redirect("/assistant/mngevent/detail/" + idEvent);
      }
    } catch (err) {
      req.flash("status", "Vendor Price Cannot Be Updated to Estimation!");
      res.redirect("/assistant/mngevent/detail/" + idEvent);
      console.log(err.message);
    }
  }
});

// POST dari halaman detail event - delete vendor untuk suatu event DONE
app.post("/assistant/mngevent/detail/delete-vendor/:idEvent/:idVendor", async (req, res) => {
  const idEvent = req.params.idEvent;
  const idVendor = req.params.idVendor;

  try {
    const pool = await connect();

    const result = await pool.request().input("idEvent", sql.Int, idEvent).input("idVendor", sql.Int, idVendor).query("DELETE FROM EventVendor WHERE id_event = @idEvent AND id_vendor = @idVendor");

    if (result.rowsAffected[0] == 1) {
      req.flash("status", "Vendor Successfully Deleted From Event!");
      res.redirect("/assistant/mngevent/detail/" + idEvent);
    }
  } catch (err) {
    req.flash("status", "Vendor Cannot Be Deleted From Event!");
    res.redirect("/assistant/mngevent/detail/" + idEvent);
    console.log(err.message);
  }
});

// --------------------------- OWNER INTERFACE ------------------------------
// ROUTING
// 1.0. Route untuk ke dashboard / home owner DONE
app.get("/owner/dashboard", (req, res) => {
  res.render("dashboardowner.ejs", {
    title: "Dashboard Owner",
    active: 1,
  });
});

// 2.0. Route untuk ke Manage Assistant DONE
app.get("/owner/mngassistant", async (req, res) => {
  const statusMessages = req.flash("status");
  const status = statusMessages.length > 0 ? statusMessages[0] : null;
  const perPage = 7;
  const page = parseInt(req.query.page) || 1;
  const search = req.query.search || ""; // ambil keyword dari URL

  try {
    const pool = await connect();

    const result = await pool.request().input("search", sql.VarChar, search).query("SELECT * FROM Asisten WHERE is_active = 1 AND nama_asisten LIKE '%' + @search + '%'");

    const totalItems = result.recordset.length;
    const start = (page - 1) * perPage;
    const totalPages = Math.ceil(totalItems / perPage);

    const paginated = result.recordset.slice(start, start + perPage);

    res.render("layout-assistant.ejs", {
      title: "Manage Assistant",
      heading: "Assistant List",
      columns: ["Edit", "Name", "Address", "Contact"],
      assistants: paginated,
      active: 2,
      currentPage: page,
      totalPages: totalPages,
      status: status,
    });
  } catch (err) {
    console.log(err.message);
  }
});

// 2.1. Route untuk ke Manage Assistant - Add Assistant DONE
app.get("/owner/mngassistant/add-assistant", (req, res) => {
  res.render("layout-add-owner.ejs", {
    title: "Add Assistant",
    heading: "Add Assistant",
    formAction: "/owner/mngassistant/add-assistant",
    fields: [
      { label: "Assistant Name", name: "assistantName", placeholder: "name..." },
      { label: "Assistant Account Password", name: "assistantPassword", placeholder: "account password..." },
      { label: "Assistant Address", name: "assistantAddress", placeholder: "address..." },
      { label: "Assistant Contact", name: "assistantContact", placeholder: "contact..." },
    ],
    active: 2,
    mode: "add",
  });
});

// 2.2. Route untuk ke Manage Assistant - Edit Assistant DONE
app.get("/owner/mngassistant/edit-assistant/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const pool = await connect();

    const result = await pool.request().input("idAsisten", sql.VarChar, id).query("SELECT * FROM Asisten WHERE id_asisten = @idAsisten");

    res.render("layout-add-owner.ejs", {
      title: "Edit Assistant",
      heading: "EditAssistant",
      formAction: "/owner/mngassistant/edit-assistant/" + id,
      formDeleteAction: "/owner/mngassistant/edit-assistant/delete/" + id,
      fields: [
        { label: "Assistant Name", name: "assistantName", placeholder: "name...", value: result.recordset[0].nama_asisten },
        { label: "Assistant Account Password", name: "assistantPassword", placeholder: "account password...", value: result.recordset[0].password },
        { label: "Assistant Address", name: "assistantAddress", placeholder: "address...", value: result.recordset[0].alamat_asisten },
        { label: "Assistant Contact", name: "assistantContact", placeholder: "contact...", value: result.recordset[0].kontak_asisten },
      ],
      active: 2,
      mode: "edit",
    });
  } catch (err) {
    console.log(err.message);
  }
});

// 3.0. Route untuk ke Manage Vendor DONE
app.get("/owner/mngvendor", async (req, res) => {
  const statusMessages = req.flash("status");
  const status = statusMessages.length > 0 ? statusMessages[0] : null;
  const perPage = 7;
  const page = parseInt(req.query.page) || 1;
  const search = req.query.search || ""; // ambil keyword dari URL

  try {
    const pool = await connect();

    const result = await pool
      .request()
      .input("search", sql.VarChar, search)
      .query(
        "SELECT t2.id_vendor, t2.nama_vendor, t2.nama_pemilik, t2.alamat, t2.kontak, t2.harga_min, t2.harga_max, KategoriVendor.nama_kategori FROM (SELECT * FROM Vendor WHERE is_active = 1 AND nama_vendor LIKE '%' + @search + '%') AS t2 INNER JOIN KategoriVendor ON KategoriVendor.id_kategori = t2.id_kategori "
      );

    const totalItems = result.recordset.length;
    const start = (page - 1) * perPage;
    const totalPages = Math.ceil(totalItems / perPage);

    const paginated = result.recordset.slice(start, start + perPage);

    res.render("layout-vendor.ejs", {
      title: "Manage Vendor",
      heading: "Vendor List",
      columns: ["Edit", "Name", "Owner", "Address", "Price Range", "Type", "Contact"],
      vendors: paginated,
      active: 3,
      currentPage: page,
      totalPages: totalPages,
      status: status,
    });
  } catch (err) {
    console.log(err.message);
  }
});

// 3.1. Route untuk ke Manage Vendor - Add Vendor DONE
app.get("/owner/mngvendor/add-vendor", async (req, res) => {
  try {
    const pool = await connect();

    const result = await pool.request().query("SELECT * FROM KategoriVendor WHERE is_active = 1");

    res.render("layout-add-owner.ejs", {
      title: "Add Vendor",
      heading: "Add Vendor",
      formAction: "/owner/mngvendor/add-vendor",
      fields: [
        { label: "Vendor Name", name: "vendorName", placeholder: "name...", type: "text" },
        { label: "Vendor Owner", name: "vendorOwner", placeholder: "owner...", type: "text" },
        { label: "Vendor Address", name: "vendorAddress", placeholder: "address...", type: "text" },
        { label: "Min Price", name: "minPrice", placeholder: "min price...", type: "text" },
        { label: "Max Price", name: "maxPrice", placeholder: "max price...", type: "text" },
        {
          label: "Type",
          name: "type",
          type: "select",
          options: result.recordset,
        },
        { label: "Contact", name: "contact", placeholder: "contact...", type: "text" },
      ],
      active: 3,
      mode: "add",
    });
  } catch (err) {
    console.log(err.message);
  }
});

// 3.2 Route untuk ke Manage Vendor - Edit Vendor DONE
app.get("/owner/mngvendor/edit-vendor/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const pool = await connect();

    const result = await pool.request().query("SELECT * FROM KategoriVendor WHERE is_active = 1");

    const resultValue = await pool.request().input("id", sql.Int, id).query("SELECT * FROM Vendor WHERE id_vendor = @id");

    res.render("layout-add-owner.ejs", {
      title: "Edit Vendor",
      heading: "Edit Vendor",
      formAction: "/owner/mngvendor/edit-vendor/" + id,
      formDeleteAction: "/owner/mngvendor/edit-vendor/delete/" + id,
      fields: [
        { label: "Vendor Name", name: "vendorName", placeholder: "name...", type: "text", value: resultValue.recordset[0].nama_vendor },
        { label: "Vendor Owner", name: "vendorOwner", placeholder: "owner...", type: "text", value: resultValue.recordset[0].nama_pemilik },
        { label: "Vendor Address", name: "vendorAddress", placeholder: "address...", type: "text", value: resultValue.recordset[0].alamat },
        { label: "Min Price", name: "minPrice", placeholder: "min price...", type: "text", value: resultValue.recordset[0].harga_min },
        { label: "Max Price", name: "maxPrice", placeholder: "max price...", type: "text", value: resultValue.recordset[0].harga_max },
        {
          label: "Type",
          name: "type",
          type: "select",
          options: result.recordset,
          value: resultValue.recordset[0].id_kategori,
        },
        { label: "Contact", name: "contact", placeholder: "contact...", type: "text", value: resultValue.recordset[0].kontak },
      ],
      active: 3,
      mode: "edit",
    });
  } catch (err) {
    console.log(err.message);
  }
});

// 3.3 Route untuk ke Manage Vendor - Manage Type DONE
app.get("/owner/mngvendor/mngtype", async (req, res) => {
  const statusMessages = req.flash("status");
  const status = statusMessages.length > 0 ? statusMessages[0] : null;
  const perPage = 6;
  const page = parseInt(req.query.page) || 1;
  const search = req.query.search || ""; // ambil keyword dari URL

  try {
    const pool = await connect();

    const result = await pool.request().input("search", sql.NVarChar, search).query("SELECT * FROM KategoriVendor WHERE is_active = 1 AND nama_kategori LIKE '%' + @search + '%'");

    const totalItems = result.recordset.length;
    const start = (page - 1) * perPage;
    const totalPages = Math.ceil(totalItems / perPage);

    const paginated = result.recordset.slice(start, start + perPage);

    res.render("manageVendorType.ejs", {
      title: "Edit Vendor",
      vendorTypes: paginated,
      currentPage: page,
      totalPages: totalPages,
      status: status,
      active: 3,
    });
  } catch (err) {
    console.log(err.message);
  }
});

// 4.0 Route untuk ke Laporan Kerjasama DONE
app.get("/owner/lapkerjasama", async (req, res) => {
  const statusMessages = req.flash("status");
  const status = statusMessages.length > 0 ? statusMessages[0] : null;
  const perPage = 10;
  const page = parseInt(req.query.page) || 1;
  const search = req.query.search || ""; // ambil keyword dari URL

  try {
    const pool = await connect();

    const result = await pool
      .request()
      .input("search", sql.VarChar, search)
      .query(
        "SELECT v.id_vendor, v.nama_vendor, COUNT(CASE WHEN e.status = 'On Process' THEN 1 END) AS OnProcess, COUNT(CASE WHEN e.status = 'Finished' THEN 1 END) AS Finished, COUNT(CASE WHEN e.status IN ('On Process', 'Finished') THEN 1 END) AS Total FROM Vendor v LEFT JOIN EventVendor ev ON v.id_vendor = ev.id_vendor LEFT JOIN Event e ON ev.id_event = e.id_event WHERE v.nama_vendor LIKE '%' + @search + '%' AND v.is_active = 1 GROUP BY v.id_vendor, v.nama_vendor ORDER BY v.id_vendor;"
      );

    const totalItems = result.recordset.length;
    const start = (page - 1) * perPage;
    const totalPages = Math.ceil(totalItems / perPage);

    const paginated = result.recordset.slice(start, start + perPage);

    res.render("layout-lapks.ejs", {
      title: "Laporan Kerjasama",
      heading: "Laporan Kerjasama",
      columns: ["Vendor", "On Process", "Finished", "Total Kerjasama", ""],
      vendors: paginated,
      active: 4,
      currentPage: page,
      totalPages: totalPages,
      status: status,
    });
  } catch (err) {
    console.log(err.message);
  }
});

// 4.1. Route untuk ke Laporan Kerjasama - Detail
app.get("/owner/lapkerjasama/detail/:id", async (req, res) => {
  const idVendor = req.params.id;
  const statusMessages = req.flash("status");
  const status = statusMessages.length > 0 ? statusMessages[0] : null;
  const perPage = 7;
  const page = parseInt(req.query.page) || 1;

  try {
    const pool = await connect();

    const namaVendor = await pool
      .request()
      .input("idVendor", sql.Int, idVendor)
      .query("SELECT nama_vendor FROM Vendor WHERE id_vendor = @idVendor");

    const result = await pool
      .request()
      .input("idVendor", sql.Int, idVendor)
      .query(
        "SELECT Klien.nama, JenisEvent.nama_jenis, KategoriVendor.nama_kategori, ev.harga_dealing FROM (SELECT * FROM EventVendor WHERE id_vendor = @idVendor) AS ev INNER JOIN Event ON Event.id_event = ev.id_event INNER JOIN Vendor ON Vendor.id_vendor = ev.id_vendor INNER JOIN MenyelenggarakanEvent ON MenyelenggarakanEvent.id_event = Event.id_event INNER JOIN Klien ON Klien.id_klien = MenyelenggarakanEvent.id_klien INNER JOIN JenisEvent ON JenisEvent.id_jenis = Event.id_jenis INNER JOIN KategoriVendor ON Vendor.id_kategori = KategoriVendor.id_kategori"
      );

    const totalItems = result.recordset.length;
    const start = (page - 1) * perPage;
    const totalPages = Math.ceil(totalItems / perPage);

    const paginated = result.recordset.slice(start, start + perPage);

    const sum = await pool
      .request()
      .input("idVendor", sql.Int, idVendor)
      .query("SELECT SUM(harga_dealing) AS 'Sum' FROM EventVendor WHERE id_vendor = @idVendor");

    res.render("detail-lapks.ejs", {
      title: "Detail Kerjasama",
      heading: namaVendor.recordset[0].nama_vendor + "'s History",
      columns: ["Event", "Type", "Dealing Price"],
      active: 4,
      vendors: paginated,
      currentPage: page,
      totalPages: totalPages,
      sum: sum.recordset[0].Sum,
    });
  } catch (err) {
    console.log(err.message);
  }
});

// 5.0. Route untuk ke Laporan Event DONE
app.get("/owner/lapevent", async (req, res) => {
  const statusMessages = req.flash("status");
  const status = statusMessages.length > 0 ? statusMessages[0] : null;
  const perPage = 10;
  const page = parseInt(req.query.page) || 1;
  const search = req.query.search || ""; // ambil keyword dari URL

  try {
    const pool = await connect();

    const result = await pool
      .request()
      .input("search", sql.VarChar, search)
      .query(
        "SELECT Event.id_event, Klien.nama, JenisEvent.nama_jenis, CONVERT(VARCHAR, Event.tanggal, 23) AS tanggal, Event.status, Asisten.nama_asisten FROM MenyelenggarakanEvent INNER JOIN Event ON Event.id_event = MenyelenggarakanEvent.id_event INNER JOIN Asisten ON Asisten.id_asisten = MenyelenggarakanEvent.id_asisten INNER JOIN Klien ON Klien.id_klien = MenyelenggarakanEvent.id_klien INNER JOIN JenisEvent ON Event.id_jenis = JenisEvent.id_jenis WHERE Klien.nama LIKE '%' + @search + '%' ORDER BY status DESC"
      );

    const totalItems = result.recordset.length;
    const start = (page - 1) * perPage;
    const totalPages = Math.ceil(totalItems / perPage);

    const paginated = result.recordset.slice(start, start + perPage);

    res.render("layout-lapevent.ejs", {
      title: "Laporan Event",
      heading: "Laporan Event",
      columns: ["Client", "Event Type", "Event Date", "Status", "Handled By", ""],
      events: paginated,
      active: 5,
      currentPage: page,
      totalPages: totalPages,
      status: status,
    });
  } catch (err) {
    console.log(err.message);
  }
});

// 5.1. Route untuk ke Laporan Event - Detail DONE
app.get("/owner/lapevent/detail/:id", async (req, res) => {
  const id = req.params.id;

  const perPage = 7;
  const page = parseInt(req.query.page) || 1;

  try {
    const pool = await connect();

    const result = await pool
      .request()
      .input("idEvent", sql.Int, id)
      .query(
        "SELECT Vendor.id_vendor, Vendor.nama_vendor, KategoriVendor.nama_kategori, EventVendor.harga_dealing, Vendor.harga_min, Vendor.harga_max FROM (SELECT * FROM Event WHERE id_event = @idEvent) AS e INNER JOIN EventVendor ON EventVendor.id_event = e.id_event INNER JOIN Vendor ON EventVendor.id_vendor = Vendor.id_vendor INNER JOIN KategoriVendor ON KategoriVendor.id_kategori = Vendor.id_kategori"
      );

    const totalItems = result.recordset.length;
    const start = (page - 1) * perPage;
    const totalPages = Math.ceil(totalItems / perPage);

    const paginated = result.recordset.slice(start, start + perPage);

    const totalFix = await pool
      .request()
      .input("idEvent", sql.Int, req.params.id)
      .query("SELECT SUM(EventVendor.harga_dealing) AS 'TotalFix' FROM(SELECT * FROM Event WHERE id_event = @idEvent) AS e INNER JOIN EventVendor ON EventVendor.id_event = e.id_event");

    const heading = await pool
      .request()
      .input("idEvent", sql.Int, req.params.id)
      .query(
        "SELECT Klien.nama, JenisEvent.nama_jenis FROM (SELECT * FROM Event WHERE id_event = @idEvent) AS e INNER JOIN MenyelenggarakanEvent ON e.id_event = MenyelenggarakanEvent.id_event INNER JOIN JenisEvent ON e.id_jenis = JenisEvent.id_jenis INNER JOIN Klien ON MenyelenggarakanEvent.id_klien = Klien.id_klien"
      );

    res.render("detail-event-owner.ejs", {
      title: "Event - Vendor Detail",
      heading: heading.recordset[0].nama + "'s " + heading.recordset[0].nama_jenis,
      columns: ["Vendor", "Type", "Price", "Status"],
      vendors: paginated,
      active: 5,
      currentPage: page,
      totalPages: totalPages,
      totalFix: totalFix.recordset[0].TotalFix,
    });
  } catch (err) {
    console.log(err.message);
  }
});

// POST HANDLING
// 2.1. POST dari Manage Assistant - Add Assistant DONE
app.post("/owner/mngassistant/add-assistant", async (req, res) => {
  const { assistantName, assistantPassword, assistantAddress, assistantContact } = req.body;

  try {
    const pool = await connect();

    const result = await pool
      .request()
      .input("assistantName", sql.NVarChar, assistantName)
      .input("assistantAddress", sql.NVarChar, assistantAddress)
      .input("assistantContact", sql.NVarChar, assistantContact)
      .input("assistantPassword", sql.NVarChar, assistantPassword)
      .query("INSERT INTO Asisten(nama_asisten, password, alamat_asisten, kontak_asisten) VALUES(@assistantName, @assistantPassword, @assistantAddress, @assistantContact)");

    if (result.rowsAffected[0] == 1) {
      req.flash("status", "Assistant Successfully Added!");
      res.redirect("/owner/mngassistant");
    }
  } catch (err) {
    req.flash("status", "Assistant Cannot Be Added!");
    res.redirect("/owner/mngassistant");
    console.log(err.message);
  }
});

// 2.2. POST dari Manage Assistant - Edit Assistant DONE
app.post("/owner/mngassistant/edit-assistant/:id", async (req, res) => {
  const id = req.params.id;
  const { assistantName, assistantPassword, assistantAddress, assistantContact } = req.body;

  try {
    const pool = await connect();

    const result = await pool
      .request()
      .input("assistantName", sql.NVarChar, assistantName)
      .input("assistantAddress", sql.NVarChar, assistantAddress)
      .input("assistantContact", sql.NVarChar, assistantContact)
      .input("assistantPassword", sql.NVarChar, assistantPassword)
      .input("idAsisten", sql.NVarChar, id)
      .query("UPDATE Asisten SET nama_asisten = @assistantName, password = @assistantPassword, alamat_asisten = @assistantAddress, kontak_asisten = @assistantContact WHERE id_asisten = @idAsisten");

    if (result.rowsAffected[0] == 1) {
      req.flash("status", "Assistant Successfully Updated!");
      res.redirect("/owner/mngassistant");
    }
  } catch (err) {
    req.flash("status", "Assistant Cannot Be Updated!");
    res.redirect("/owner/mngassistant");
    console.log(err.message);
  }
});

// 2.2.1 POST dari Manage Assistant - Edit Assistant - Delete DONE
app.post("/owner/mngassistant/edit-assistant/delete/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const pool = await connect();

    const result = await pool.request().input("idAsisten", sql.NVarChar, id).query("UPDATE Asisten SET is_active = 0 WHERE id_asisten = @idAsisten");

    if (result.rowsAffected[0] == 1) {
      req.flash("status", "Assistant Successfully Deleted!");
      res.redirect("/owner/mngassistant");
    }
  } catch (err) {
    req.flash("status", "Assistant Cannot Be Deleted!");
    res.redirect("/owner/mngassistant");
    console.log(err.message);
  }
});

// 3.1. POST dari Manage Vendor - Add Vendor DONE
app.post("/owner/mngvendor/add-vendor", async (req, res) => {
  const { vendorName, vendorOwner, vendorAddress, minPrice, maxPrice, type, contact } = req.body;

  try {
    const pool = await connect();

    const result = await pool
      .request()
      .input("vendorName", sql.NVarChar, vendorName)
      .input("vendorOwner", sql.NVarChar, vendorOwner)
      .input("vendorAddress", sql.NVarChar, vendorAddress)
      .input("minPrice", sql.Int, minPrice)
      .input("maxPrice", sql.Int, maxPrice)
      .input("vendorType", sql.Int, type)
      .input("vendorContact", sql.NVarChar, contact)
      .query("INSERT INTO Vendor(nama_vendor, nama_pemilik, alamat, kontak, harga_min, harga_max, id_kategori) VALUES(@vendorName, @vendorOwner, @vendorAddress, @vendorContact, @minPrice, @maxPrice, @vendorType)");

    if (result.rowsAffected[0] == 1) {
      req.flash("status", "Vendor Successfully Added!");
      res.redirect("/owner/mngvendor");
    }
  } catch (err) {
    req.flash("status", "Vendor Cannot Be Added!");
    res.redirect("/owner/mngvendor");
    console.log(err.message);
  }
});

// 3.2 POST dari Manage Vendor - Edit Vendor DONE
app.post("/owner/mngvendor/edit-vendor/:id", async (req, res) => {
  const id = req.params.id;
  const { vendorName, vendorOwner, vendorAddress, minPrice, maxPrice, type, contact } = req.body;

  try {
    const pool = await connect();

    const result = await pool
      .request()
      .input("vendorName", sql.NVarChar, vendorName)
      .input("vendorOwner", sql.NVarChar, vendorOwner)
      .input("vendorAddress", sql.NVarChar, vendorAddress)
      .input("minPrice", sql.Int, minPrice)
      .input("maxPrice", sql.Int, maxPrice)
      .input("vendorType", sql.Int, type)
      .input("vendorContact", sql.NVarChar, contact)
      .input("idVendor", sql.Int, id)
      .query("UPDATE Vendor SET nama_vendor = @vendorName, nama_pemilik = @vendorOwner, alamat = @vendorAddress, kontak = @vendorContact, harga_min = @minPrice, harga_max = @maxPrice, id_kategori = @vendorType WHERE id_vendor = @idVendor");

    if (result.rowsAffected[0] == 1) {
      req.flash("status", "Vendor Successfully Updated!");
      res.redirect("/owner/mngvendor");
    }
  } catch (err) {
    req.flash("status", "Vendor Cannot Be Updated!");
    res.redirect("/owner/mngvendor");
    console.log(err.message);
  }
});

// 3.2.1 POST dari Manage Vendor - Edit Vendor - Delete DONE
app.post("/owner/mngvendor/edit-vendor/delete/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const pool = await connect();

    const result = await pool.request().input("idVendor", sql.NVarChar, id).query("UPDATE Vendor SET is_active = 0 WHERE id_vendor = @idVendor");

    if (result.rowsAffected[0] == 1) {
      req.flash("status", "Vendor Successfully Deleted!");
      res.redirect("/owner/mngvendor");
    }
  } catch (err) {
    req.flash("status", "Vendor Cannot Be Deleted!");
    res.redirect("/owner/mngvendor");
    console.log(err.message);
  }
});

// POST dari Manage Vendor - Manage Vendor Type - Add Type DONE
app.post("/owner/mngvendor/mngtype/add-type", async (req, res) => {
  const { typeName } = req.body;

  try {
    const pool = await connect();

    const result = await pool.request().input("typeName", sql.NVarChar, typeName).query("INSERT INTO KategoriVendor(nama_kategori) VALUES(@typeName)");

    if (result.rowsAffected[0] == 1) {
      req.flash("status", "Vendor Type Successfully Added!");
      res.redirect("/owner/mngvendor/mngtype");
    }
  } catch (err) {
    req.flash("status", "Vendor Type Cannot Be Added!");
    res.redirect("/owner/mngvendor/mngtype");
    console.log(err.message);
  }
});

// POST dari Manage Vendor - Manage Vendor Type - Delete Type DONE
app.post("/owner/mngvendor/mngtype/delete/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const pool = await connect();

    const result = await pool.request().input("id", sql.Int, id).query("UPDATE KategoriVendor SET is_active = 0 WHERE id_kategori = @id");

    if (result.rowsAffected[0] == 1) {
      req.flash("status", "Vendor Type Successfully Deleted!");
      res.redirect("/owner/mngvendor/mngtype");
    }
  } catch (err) {
    req.flash("status", "Vendor Type Cannot Be Deleted!");
    res.redirect("/owner/mngvendor/mngtype");
    console.log(err.message);
  }
});

// POST dari Manage Vendor - Manage Vendor Type - Update Type DONE
app.post("/owner/mngvendor/mngtype/update/:id", async (req, res) => {
  const id = req.params.id;
  const newType = req.body.newType;

  try {
    const pool = await connect();

    const result = await pool.request().input("id", sql.Int, id).input("typeName", sql.NVarChar, newType).query("UPDATE KategoriVendor SET nama_kategori = @typeName WHERE id_kategori = @id");

    if (result.rowsAffected[0] == 1) {
      req.flash("status", "Vendor Type Successfully Updated!");
      res.redirect("/owner/mngvendor/mngtype");
    }
  } catch (err) {
    req.flash("status", "Vendor Type Cannot Be Updated!");
    res.redirect("/owner/mngvendor/mngtype");
    console.log(err.message);
  }
});

// Menentukan port server
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
