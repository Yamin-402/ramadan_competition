const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const moment = require('moment-timezone');
const app = express();
const DB_FILE = path.join('/data', 'database.db');
const db = new sqlite3.Database(DB_FILE);

// رمضان
const ramadanStart = moment.tz("2025-03-01", "YYYY-MM-DD", "Africa/Cairo"); // تاريخ بداية رمضان 2024
const today = moment().tz("Africa/Cairo");
const dayOfRamadan = today.isSameOrAfter(ramadanStart) ? today.diff(ramadanStart, "days") + 1 : 0; // يبدأ العد من 1

const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 100 // حدد عدد الطلبات لكل IP
});

const admin = {
    username: 'yaminadwaa',
    password: bcrypt.hashSync('Yamin1212', 8)
};

// Ensure the users table exists before inserting the admin user
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    is_admin INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0,
    show_in_leaderboard INTEGER DEFAULT 1
)`);

// Insert the admin user if it doesn't already exist
db.run(`INSERT OR IGNORE INTO users (username, password, is_admin) 
    VALUES (?, ?, 1)`, [admin.username, admin.password], function(err) {
    if (err) {
        console.error("❌ خطأ أثناء إضافة المستخدم الإداري:", err.message);
    } else {
        if (this.changes > 0) {
            console.log("✅ تم إضافة المستخدم الإداري بنجاح!");
        } else {
            console.log("✅ المستخدم الإداري موجود بالفعل، لا حاجة للإضافة.");
        }
    }
});

app.use(limiter);
app.set('trust proxy', 1);

moment.tz.setDefault('Africa/Cairo');



db.run(`ALTER TABLE task_logs ADD COLUMN fasting_status TEXT`, (err) => {
    if (err) {
        if (err.message.includes("duplicate column name")) {
            console.log("✅ العمود fasting_status موجود بالفعل، لا حاجة للإضافة.");
        } else {
            console.error("❌ خطأ أثناء إضافة العمود fasting_status:", err.message);
        }
    } else {
        console.log("✅ تم إضافة العمود fasting_status بنجاح!");
    }
});




// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes الأساسية
app.get('/',(req, res) => res.render('register', { error: null }));
app.get('/login', (req, res) => res.render('login', { error: null }));
app.get('/register', (req, res) => res.render('register', { error: null }));

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            console.error(err);
            return res.render('register', { error: 'حدث خطأ في الخادم' });
        }
        
        if (user) {
            return res.render('register', { error: 'اسم المستخدم موجود مسبقاً' });
        }
        
        bcrypt.hash(password, 8, (err, hash) => {
            if (err) {
                console.error(err);
                return res.render('register', { error: 'خطأ في تشفير كلمة المرور' });
            }
            
            db.run(
                'INSERT INTO users (username, password) VALUES (?, ?)',
                [username, hash],
                function(err) {
                    if (err) {
                        console.error(err);
                        return res.render('register', { error: 'فشل في إنشاء الحساب' });
                    }
                    res.redirect('/login');
                }
            );
        });
    });
});

// معالجة تسجيل الدخول
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.render('login', { error: 'بيانات الدخول غير صحيحة' });
        }
        
        if (user.is_admin) return res.redirect('/admin/tasks'); // تحويل المشرف إلى إدارة المهام
        res.redirect(`/profile/${user.id}/tasks`); // تحويل المستخدم العادي إلى صفحة المهام
    });
});

// Routes الملف الشخصي

app.get('/profile/:id/winner', (req, res) => {
    const userId = req.params.id;
    const { fajr, maghrib } = getPrayerTimes();
    const now = moment().tz("Africa/Cairo");
    const isFastingNow = now.isBetween(moment(fajr, "HH:mm"), moment(maghrib, "HH:mm"));

    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) {
            console.error(err);
            return res.status(500).send("خطأ في جلب بيانات المستخدم");
        }

        db.all('SELECT * FROM tasks', (err, tasks) => {
            if (err) {
                console.error(err);
                return res.status(500).send("خطأ في جلب قائمة المهام");
            }

            // Add this query to get all users
            db.all('SELECT * FROM users WHERE show_in_leaderboard = 1 AND is_admin = 0 ORDER BY points DESC', (err, users) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send("خطأ في جلب بيانات المتصدرين");
                }

                res.render('profile/winner', { 
                    user, 
                    users, // Pass the users list to the template
                    tasks, 
                    moment, 
                    dayOfRamadan, 
                    isFastingNow 
                });
            });
        });
    });
});



app.get('/profile/:id/tasks', (req, res) => {
    console.log("🔹 تم تنفيذ /profile/:id/tasks");
    const userId = req.params.id;
    console.log("🔹 User ID:", userId);

    
app.get('/profile/:id/tasks', (req, res) => {
    const userId = req.params.id;
    console.log("User ID:", req.params.id);

    // جلب أوقات الفجر والمغرب
    const { fajr, maghrib } = getPrayerTimes();
    const now = moment().tz("Africa/Cairo");

    // تحديد ما إذا كان المستخدم في وقت الصيام
    const isFastingNow = now.isBetween(moment(fajr, "HH:mm"), moment(maghrib, "HH:mm"));

    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) {
            console.error(err);
            return res.status(500).send("خطأ في جلب بيانات المستخدم");
        }

        db.all('SELECT * FROM tasks', (err, tasks) => {
            if (err) {
                console.error(err);
                return res.status(500).send("خطأ في جلب قائمة المهام");
            }

            res.render('profile/tasks', { user, tasks, moment, dayOfRamadan, isFastingNow });
        });
    });
});


app.get('/profile/:id/logs', (req, res) => {
    const userId = req.params.id;

    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) {
            console.error(err);
            return res.status(500).send("خطأ في جلب بيانات المستخدم");
        }

        db.all('SELECT * FROM task_logs WHERE user_id = ?', [userId], (err, logs) => {
            if (err) {
                console.error(err);
                return res.status(500).send("خطأ في جلب سجل المهام");
            }

            // تحويل logs إلى مصفوفة إذا لم تكن كذلك
            if (!Array.isArray(logs)) {
                logs = [];
            }

            res.render('profile/logs', { user, logs, moment, dayOfRamadan });
        });
    });
});

app.get('/profile/:id/questions', (req, res) => {
    const userId = req.params.id;

    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) {
            console.error(err);
            return res.status(500).send("خطأ في جلب بيانات المستخدم");
        }

        db.get('SELECT * FROM daily_questions WHERE DATE(created_at) = DATE("now")', (err, dailyQuestion) => {
            if (err) {
                console.error(err);
                return res.status(500).send("خطأ في جلب سؤال اليوم");
            }

            const currentDay = moment().tz("Africa/Cairo").format("YYYY-MM-DD");

            res.render('profile/questions', { user, dailyQuestion, moment, dayOfRamadan,  });
        });
    });
});

app.get('/profile/:id/prohibited-tasks', (req, res) => {
    const userId = req.params.id;

    // جلب أوقات الفجر والمغرب
    const { fajr, maghrib } = getPrayerTimes();
    const now = moment().tz("Africa/Cairo");

    // تحديد ما إذا كان المستخدم في وقت الصيام
    const isFastingNow = now.isBetween(moment(fajr, "HH:mm"), moment(maghrib, "HH:mm"));

    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) {
            console.error(err);
            return res.status(500).send("خطأ في جلب بيانات المستخدم");
        }

        db.all('SELECT * FROM tasks WHERE task_category = "ممنوع"', (err, tasks) => {
            if (err) {
                console.error(err);
                return res.status(500).send("خطأ في جلب قائمة المهام الممنوعة");
            }

            res.render('profile/prohibited-tasks', { user, tasks, moment, dayOfRamadan, isFastingNow });
        });
    });
});

// Routes الإدارة

app.get('/admin/tasks', (req, res) => {
    db.all('SELECT * FROM tasks', (err, tasks) => {
        if (err) {
            console.error(err);
            return res.status(500).send("خطأ في جلب قائمة المهام");
        }

        // جلب المهام الفرعية لكل مهمة مشروطة
        const tasksWithSubtasks = tasks.map(task => {
            return new Promise((resolve, reject) => {
                if (task.task_type === 'مشروطة') {
                    db.all('SELECT * FROM subtasks WHERE task_id = ?', [task.id], (err, subtasks) => {
                        if (err) {
                            console.error(err);
                            reject(err);
                        } else {
                            task.subtasks = subtasks;
                            resolve(task);
                        }
                    });
                } else {
                    task.subtasks = [];
                    resolve(task);
                }
            });
        });

        Promise.all(tasksWithSubtasks)
            .then(tasks => {
                res.render('admin/tasks', { tasks, moment });
            })
            .catch(err => {
                console.error(err);
                res.status(500).send("خطأ في جلب المهام الفرعية");
            });
    });
});

app.post('/admin/add-task', (req, res) => {
    const { task_name, task_type, task_category, task_repeat, points, details, subtasks, min_threshold } = req.body;

    if (points < 0.125) {
        return res.status(400).send("الحد الأدنى للنقاط هو 0.125");
    }

    db.run(`
        INSERT INTO tasks (task_name, task_type, task_category, task_repeat, points, details, min_threshold)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [task_name, task_type, task_category, task_repeat, points, details, min_threshold || null], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).send("خطأ في إضافة المهمة");
        }

        // إضافة المهام الفرعية إذا كانت المهمة مشروطة
        if (task_type === 'مشروطة' && subtasks) {
            const stmt = db.prepare('INSERT INTO subtasks (task_id, description) VALUES (?, ?)');
            subtasks.forEach(subtask => {
                stmt.run([this.lastID, subtask]);
            });
            stmt.finalize();
        }

        res.redirect('/admin/tasks');
    });
});


app.post('/admin/delete-task/:id', (req, res) => {
    const taskId = req.params.id;

    db.run('DELETE FROM tasks WHERE id = ?', [taskId], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send("خطأ في حذف المهمة");
        }

        res.redirect('/admin/tasks');
    });
});

app.get('/admin/edit-task/:id', (req, res) => {
    const taskId = req.params.id;

    db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, task) => {
        if (err || !task) {
            console.error(err);
            return res.status(500).send("خطأ في جلب بيانات المهمة");
        }

        db.all('SELECT * FROM subtasks WHERE task_id = ?', [taskId], (err, subtasks) => {
            if (err) {
                console.error(err);
                return res.status(500).send("خطأ في جلب المهام الفرعية");
            }

            res.render('admin/edit-task', { task, subtasks });
        });
    });
});

app.post('/admin/update-task/:id', (req, res) => {
    const taskId = req.params.id;
    const { task_name, task_type, task_category, task_repeat, points, details, subtasks } = req.body;

    db.run(`
        UPDATE tasks SET
        task_name = ?, task_type = ?, task_category = ?, task_repeat = ?, points = ?, details = ?
        WHERE id = ?
    `, [task_name, task_type, task_category, task_repeat, points, details, taskId], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).send("خطأ في تحديث المهمة");
        }

        db.run('DELETE FROM subtasks WHERE task_id = ?', [taskId], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send("خطأ في تحديث المهام الفرعية");
            }

            if (task_type === 'مشروطة' && subtasks) {
                const stmt = db.prepare('INSERT INTO subtasks (task_id, description) VALUES (?, ?)');
                subtasks.forEach(subtask => {
                    stmt.run([taskId, subtask]);
                });
                stmt.finalize();
            }

            res.redirect('/admin/tasks');
        });
    });
});

app.get('/admin/questions', (req, res) => {
    db.all('SELECT * FROM daily_questions', (err, questions) => {
        if (err) {
            console.error(err);
            return res.status(500).send("خطأ في جلب قائمة الأسئلة");
        }

        res.render('admin/questions', { questions, moment });
    });
});

app.post('/admin/add-question', (req, res) => {
    const { question, option1, option2, option3, option4, correct_option, points } = req.body;

    db.get('SELECT COUNT(*) AS count FROM daily_questions WHERE DATE(created_at) = DATE("now")', (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).send("خطأ في التحقق من عدد الأسئلة");
        }

        if (row.count >= 1) {
            // تأجيل السؤال الإضافي ليوم لاحق
            const tomorrow = moment().tz("Africa/Cairo").add(1, 'day').format("YYYY-MM-DD");
            db.run(`
                INSERT INTO daily_questions (question, option1, option2, option3, option4, correct_option, points, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [question, option1, option2, option3, option4, correct_option, points, tomorrow], (err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send("خطأ في تأجيل السؤال");
                }

                res.redirect('/admin/questions');
            });
        } else {
            // نشر السؤال اليوم
            db.run(`
                INSERT INTO daily_questions (question, option1, option2, option3, option4, correct_option, points)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [question, option1, option2, option3, option4, correct_option, points], (err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send("خطأ في إضافة السؤال");
                }

                res.redirect('/admin/questions');
            });
        }
    });
});

app.post('/admin/delete-question/:id', (req, res) => {
    const questionId = req.params.id;

    db.run('DELETE FROM daily_questions WHERE id = ?', [questionId], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send("خطأ في حذف السؤال");
        }

        res.redirect('/admin/questions');
    });
});

app.get('/admin/questions', (req, res) => {
    db.all('SELECT * FROM daily_questions ORDER BY created_at DESC', (err, questions) => {
        if (err) {
            console.error(err);
            return res.status(500).send("خطأ في جلب قائمة الأسئلة");
        }

        return res.render('admin/questions', { questions, moment });
    });
});

app.post('/admin/update-question/:id', (req, res) => {
    const questionId = req.params.id;
    const { question, option1, option2, option3, option4, correct_option, points } = req.body;

    if (!question || !option1 || !option2 || !option3 || !option4 || !correct_option || !points) {
        return res.status(400).send("جميع الحقول مطلوبة");
    }

    db.run(`
        UPDATE daily_questions SET
        question = ?, option1 = ?, option2 = ?, option3 = ?, option4 = ?, correct_option = ?, points = ?
        WHERE id = ?
    `, [question, option1, option2, option3, option4, correct_option, points, questionId], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send("خطأ في تحديث السؤال");
        }

        return res.redirect('/admin/questions');
    });
});

app.post('/answer-question/:userId', (req, res) => {
    const userId = req.params.userId;
    const { questionId, answer, reason } = req.body;

    db.get('SELECT * FROM daily_questions WHERE id = ?', [questionId], (err, question) => {
        if (err || !question) {
            console.error(err);
            return res.status(500).send("خطأ في جلب بيانات السؤال");
        }

        // التحقق من أن المستخدم لم يجاوب على السؤال من قبل
        db.get('SELECT * FROM task_logs WHERE user_id = ? AND task_id = ?', [userId, questionId], (err, log) => {
            if (err) {
                console.error(err);
                return res.status(500).send("خطأ في التحقق من الإجابة");
            }

            if (log) {
                return res.status(400).send("لقد أجبت على هذا السؤال من قبل");
            }

            const isCorrect = question.correct_option == answer;
            const points = isCorrect ? question.points : 0;

            db.run(`
                INSERT INTO task_logs (user_id, task_id, task_type, answer, points)
                VALUES (?, ?, ?, ?, ?)
            `, [userId, questionId, 'question', reason || answer, points], (err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send("خطأ في تسجيل الإجابة");
                }

                return res.redirect(`/profile/${userId}/questions`);
            });
        });
    });
});

app.get('/admin/user-logs/:userId', (req, res) => {
    const userId = req.params.userId;

    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) {
            console.error(err);
            return res.status(500).send("خطأ في جلب بيانات المستخدم");
        }

        db.all('SELECT * FROM task_logs WHERE user_id = ?', [userId], (err, logs) => {
            if (err) {
                console.error(err);
                return res.status(500).send("خطأ في جلب سجل النشاطات");
            }

            // تحويل logs إلى مصفوفة إذا لم تكن كذلك
            if (!Array.isArray(logs)) {
                logs = [];
            }

            res.render('admin/user-logs', { user, logs, moment, dayOfRamadan });
        });
    });
});


app.post('/admin/delete-user/:userId', (req, res) => {
    const userId = req.params.userId;
    db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send("خطأ في حذف المتسابق");
        }
        return res.redirect('/admin/participants');
    });
});

const PrayTimes = require('praytimes');

const prayTimes = new PrayTimes('Egypt');

const getPrayerTimes = () => {
    const date = new Date();
    const coordinates = [30.0444, 31.2357]; // إحداثيات القاهرة
    const times = prayTimes.getTimes(date, coordinates, 2); // +2 توقيت القاهرة
    return {
        fajr: times.fajr,
        maghrib: times.maghrib
    };
};

app.post('/complete-task/:userId', (req, res) => {
    const userId = req.params.userId;
    const { taskId, value, fasting_status } = req.body;

    db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, task) => {
        if (err || !task) {
            console.error(err);
            return res.status(500).send("خطأ في جلب بيانات المهمة");
        }

        const pointsMultiplier = fasting_status === "fasting" ? 1.5 : 1;
        let points = 0;

        if (task.task_type === 'عددية') {
            const times = parseInt(value) || 1;
            points = task.is_negative ? -task.points * pointsMultiplier * times : task.points * pointsMultiplier * times;
        } else if (task.task_type === 'موقوت') {
            const minutes = parseInt(value) || 0;
            const percentage = (minutes / 60) * 100;
            const minThreshold = task.min_threshold || 0;
            const effectivePercentage = Math.max(percentage, minThreshold);
            points = task.points * (effectivePercentage / 100) * pointsMultiplier;
            if (task.is_negative) points = -points;
        } else {
            points = task.is_negative ? -task.points * pointsMultiplier : task.points * pointsMultiplier;
        }

        db.run(`UPDATE users SET points = points + ? WHERE id = ?`, [points, userId], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send("خطأ في تحديث النقاط");
            }

            db.run(`
                INSERT INTO task_logs (user_id, task_id, task_type, task_name, task_category, value, points, fasting_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [userId, task.id, task.task_type, task.task_name, task.task_category, value || null, points, fasting_status], (err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send("خطأ في إكمال المهمة");
                }

                // ✅ التحقق من إعادة التوجيه بشكل صحيح
                if (task.task_category === 'ممنوع') {
                    return res.redirect(`/profile/${userId}/prohibited-tasks`);
                } else {
                    return res.redirect(`/profile/${userId}/tasks`);
                }
            });
        });
    });
});



app.post('/admin/adjust-points/:userId', (req, res) => {
    const userId = req.params.userId;
    const { points } = req.body;

    db.run(`
        UPDATE users SET points = points + ? WHERE id = ?
    `, [points, userId], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send("خطأ في تعديل النقاط");
        }

        return res.redirect('/admin/participants');
    });
});

app.get('/admin/participants', (req, res) => {
    db.all('SELECT * FROM users WHERE is_admin = 0', (err, users, user) => {
        if (err) {
            console.error(err);
            return res.status(500).send("خطأ في جلب قائمة المتسابقين");
        }

        return res.render('admin/participants', { users, moment });
    });
});

app.get('/leaderboard/:id', (req, res) => {
    const userId = req.params.id;

    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) {
            console.error(err);
            return res.status(500).send("خطأ في جلب بيانات المستخدم");
        }

        db.all('SELECT * FROM users WHERE show_in_leaderboard = 1 AND is_admin = 0 ORDER BY points DESC', (err, users) => {
            if (err) {
                console.error(err);
                return res.status(500).send("خطأ في جلب بيانات المتصدرين");
            }
            res.render('leaderboard', { dayOfRamadan, users, user });
        });
    });
});





app.post('/admin/toggle-leaderboard/:userId', (req, res) => {
    const userId = req.params.userId;

    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) {
            console.error(err);
            return res.status(500).send("خطأ في جلب بيانات المستخدم");
        }

        const showInLeaderboard = user.show_in_leaderboard ? 0 : 1;

        db.run('UPDATE users SET show_in_leaderboard = ? WHERE id = ?', [showInLeaderboard, userId], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send("خطأ في تحديث لوحة المتصدرين");
            }

            res.redirect('/leaderboard');
        });
    });
});

app.get('/admin/delete-question/:id', (req, res) => {
    const questionId = req.params.id;

    db.run('DELETE FROM daily_questions WHERE id = ?', [questionId], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send("خطأ في حذف السؤال");
        }

        return res.redirect('/admin/questions');
    });
});

app.get('/logout', (req, res) => {
    // يمكنك إضافة منطق لتسجيل الخروج هنا (مثل حذف الجلسة)
    return res.redirect('/login');
});



// تمكين وضع WAL
db.run('PRAGMA journal_mode=WAL;', (err) => {
    if (err) {
        console.error("خطأ في تمكين وضع WAL:", err);
    } else {
        console.log("تم تمكين وضع WAL بنجاح.");
    }
});

const fs = require('fs');


// تشغيل الخادم
const PORT = process.env.PORT || 8000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`الخادم يعمل على http://localhost:${PORT}`);
});