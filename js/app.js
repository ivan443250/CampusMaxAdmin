// js/app.js

(function () {
    var loginPanel = document.getElementById("login-panel");
    var adminPanel = document.getElementById("admin-panel");

    var loginForm = document.getElementById("login-form");
    var loginStatus = document.getElementById("login-status");

    var adminEmailEl = document.getElementById("admin-email");
    var adminUidEl = document.getElementById("admin-uid");
    var universityIdEl = document.getElementById("university-id");
    var universityIdInlineEl = document.getElementById("university-id-inline");

    var universityNameInput = document.getElementById("university-name");
    var universityDescriptionInput = document.getElementById("university-description");

    var adminStatus = document.getElementById("admin-status");
    var saveUniversityButton = document.getElementById("save-university");
    var logoutButton = document.getElementById("logout");

    // --- элементы расписания ---
    var scheduleWeekSelect = document.getElementById("schedule-week");
    var scheduleDaySelect = document.getElementById("schedule-day");
    var scheduleGroupInput = document.getElementById("schedule-group");
    var scheduleStartInput = document.getElementById("schedule-start");
    var scheduleEndInput = document.getElementById("schedule-end");
    var scheduleSubjectInput = document.getElementById("schedule-subject");
    var scheduleTeacherInput = document.getElementById("schedule-teacher");
    var scheduleRoomInput = document.getElementById("schedule-room");
    var scheduleSaveButton = document.getElementById("schedule-save");
    var scheduleCancelButton = document.getElementById("schedule-cancel");
    var scheduleStatus = document.getElementById("schedule-status");
    var scheduleTableBody = document.getElementById("schedule-table-body");

    var currentUser = null;          // { id, login, fullName, role, universityId, group }
    var currentUniversityId = null;

    // что сейчас редактируем
    var editingWeekKey = null;
    var editingDayKey = null;
    var editingLessonId = null;

    // Кэш расписания текущей недели:
    // { "1": [ {id, ...}, ... ], "2": [...], ... }
    var scheduleByDay = {};

    var dayNames = {
        1: "Понедельник",
        2: "Вторник",
        3: "Среда",
        4: "Четверг",
        5: "Пятница",
        6: "Суббота",
        7: "Воскресенье"
    };

    function getCurrentWeekKey() {
        return (scheduleWeekSelect && scheduleWeekSelect.value) || "even";
    }

    function generateLessonId() {
        return "L" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function showLogin() {
        loginPanel.classList.remove("hidden");
        adminPanel.classList.add("hidden");
        loginStatus.textContent = "";
        adminStatus.textContent = "";
        setScheduleStatus("");
        currentUser = null;
        currentUniversityId = null;
        editingWeekKey = null;
        editingDayKey = null;
        editingLessonId = null;
        scheduleByDay = {};
    }

    function showAdmin() {
        loginPanel.classList.add("hidden");
        adminPanel.classList.remove("hidden");
        loginStatus.textContent = "";
        adminStatus.textContent = "";
        setScheduleStatus("");
    }

    function setLoginStatus(message, isError) {
        loginStatus.textContent = message || "";
        loginStatus.classList.remove("ok", "err");
        if (!message) return;
        loginStatus.classList.add(isError ? "err" : "ok");
    }

    function setAdminStatus(message, isError) {
        adminStatus.textContent = message || "";
        adminStatus.classList.remove("ok", "err");
        if (!message) return;
        adminStatus.classList.add(isError ? "err" : "ok");
    }

    function setScheduleStatus(message, isError) {
        scheduleStatus.textContent = message || "";
        scheduleStatus.classList.remove("ok", "err");
        if (!message) return;
        scheduleStatus.classList.add(isError ? "err" : "ok");
    }

    // ---------------- ВХОД ----------------

    if (loginForm) {
        loginForm.addEventListener("submit", function (e) {
            e.preventDefault();

            var login = document.getElementById("login").value.trim();
            var password = document.getElementById("password").value;

            if (!login || !password) {
                setLoginStatus("Введите логин и пароль", true);
                return;
            }

            setLoginStatus("Проверяем пользователя...", false);

            db.collection("users")
                .where("login", "==", login)
                .limit(1)
                .get()
                .then(function (querySnapshot) {
                    if (querySnapshot.empty) {
                        throw new Error("Пользователь с таким логином не найден");
                    }

                    var doc = querySnapshot.docs[0];
                    var data = doc.data();

                    // учебный пример: пароль в лоб
                    if (data.password !== password) {
                        throw new Error("Неверный пароль");
                    }

                    if (data.role !== "admin") {
                        throw new Error("У этого пользователя нет прав администратора");
                    }

                    if (!data.universityId) {
                        throw new Error("Для администратора не указан universityId");
                    }

                    currentUser = {
                        id: doc.id,
                        login: data.login,
                        fullName: data.fullName,
                        role: data.role,
                        universityId: data.universityId,
                        group: data.group
                    };

                    currentUniversityId = data.universityId;

                    adminEmailEl.textContent =
                        (currentUser.fullName || "(без имени)") + " (" + currentUser.login + ")";
                    adminUidEl.textContent = currentUser.id;
                    universityIdEl.textContent = currentUniversityId;
                    universityIdInlineEl.textContent = currentUniversityId;

                    if (currentUser.group && scheduleGroupInput) {
                        scheduleGroupInput.value = currentUser.group;
                    }

                    showAdmin();
                    setLoginStatus("");

                    return db.collection("universities").doc(currentUniversityId).get();
                })
                .then(function (uniDoc) {
                    if (!uniDoc) return;

                    if (uniDoc.exists) {
                        var uniData = uniDoc.data();
                        universityNameInput.value = uniData.name || "";
                        universityDescriptionInput.value = uniData.description || "";
                    } else {
                        universityNameInput.value = "";
                        universityDescriptionInput.value = "";
                        setAdminStatus(
                            "Документ вуза ещё не создан. Заполните поля и нажмите «Сохранить информацию о вузе».",
                            false
                        );
                    }

                    return loadSchedule(); // загрузим расписание для выбранной недели (по умолчанию even)
                })
                .catch(function (error) {
                    console.error("Ошибка входа:", error);
                    setLoginStatus(error.message || "Ошибка входа", true);
                });
        });
    }

    // ----------- СОХРАНЕНИЕ ИНФЫ О ВУЗЕ -----------

    if (saveUniversityButton) {
        saveUniversityButton.addEventListener("click", function () {
            if (!currentUniversityId) {
                setAdminStatus("ID вуза не определён. Войдите заново.", true);
                return;
            }

            var name = universityNameInput.value.trim();
            var description = universityDescriptionInput.value.trim();

            setAdminStatus("Сохраняем информацию о вузе...", false);

            db.collection("universities")
                .doc(currentUniversityId)
                .set(
                    {
                        name: name,
                        description: description,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    },
                    { merge: true }
                )
                .then(function () {
                    setAdminStatus("Информация о вузе сохранена", false);
                })
                .catch(function (error) {
                    console.error("Ошибка сохранения вуза:", error);
                    setAdminStatus("Ошибка сохранения: " + error.message, true);
                });
        });
    }

    // ---------------- ВЫХОД ----------------

    if (logoutButton) {
        logoutButton.addEventListener("click", function () {
            showLogin();
        });
    }

    // ------------ РАСПИСАНИЕ: CRUD ------------

    function clearScheduleForm() {
        if (!scheduleDaySelect) return;

        scheduleDaySelect.value = "1";
        if (!currentUser || !currentUser.group) {
            scheduleGroupInput.value = "";
        } else {
            scheduleGroupInput.value = currentUser.group;
        }
        scheduleStartInput.value = "";
        scheduleEndInput.value = "";
        scheduleSubjectInput.value = "";
        scheduleTeacherInput.value = "";
        scheduleRoomInput.value = "";

        editingWeekKey = null;
        editingDayKey = null;
        editingLessonId = null;

        scheduleSaveButton.textContent = "Добавить в расписание";
        scheduleCancelButton.classList.add("hidden");
        setScheduleStatus("");
    }

    // чтение: schedule/{weekKey}/days/{dayKey}.lessons
    function loadSchedule() {
        if (!currentUniversityId || !scheduleTableBody) {
            return Promise.resolve();
        }

        var weekKey = getCurrentWeekKey();
        scheduleByDay = {};

        setScheduleStatus("Загружаем расписание для недели: " + weekKey, false);

        var daysRef = db
            .collection("universities")
            .doc(currentUniversityId)
            .collection("schedule")
            .doc(weekKey)
            .collection("days");

        return daysRef
            .get()
            .then(function (snapshot) {
                snapshot.forEach(function (doc) {
                    var dayKey = doc.id; // "1".."7"
                    var data = doc.data() || {};
                    var lessons = Array.isArray(data.lessons) ? data.lessons : [];

                    // доприсвоим id, если вдруг не было
                    lessons = lessons.map(function (lesson) {
                        if (!lesson.id) {
                            lesson.id = generateLessonId();
                        }
                        return lesson;
                    });

                    scheduleByDay[dayKey] = lessons;
                });

                renderScheduleGrouped();
                setScheduleStatus("Расписание загружено", false);
            })
            .catch(function (error) {
                console.error("Ошибка загрузки расписания:", error);
                setScheduleStatus("Ошибка загрузки: " + error.message, true);
            });
    }

    function renderScheduleGrouped() {
        if (!scheduleTableBody) return;

        scheduleTableBody.innerHTML = "";

        var weekKey = getCurrentWeekKey();
        var hasLessons = false;

        for (var day = 1; day <= 7; day++) {
            var dayKey = String(day);
            var lessons = scheduleByDay[dayKey] || [];
            if (!lessons.length) continue;

            hasLessons = true;

            // заголовок дня
            var headerTr = document.createElement("tr");
            var headerTd = document.createElement("td");
            headerTd.colSpan = 7;
            headerTd.textContent = dayNames[day] + " (" + weekKey + ")";
            headerTd.style.fontWeight = "600";
            headerTd.style.paddingTop = "10px";
            headerTd.style.paddingBottom = "6px";
            headerTr.appendChild(headerTd);
            scheduleTableBody.appendChild(headerTr);

            lessons.forEach(function (lesson) {
                var tr = document.createElement("tr");

                var tdDay = document.createElement("td");
                var tdTime = document.createElement("td");
                var tdGroup = document.createElement("td");
                var tdSubject = document.createElement("td");
                var tdTeacher = document.createElement("td");
                var tdRoom = document.createElement("td");
                var tdActions = document.createElement("td");

                tdDay.textContent = ""; // день уже в заголовке
                tdTime.textContent =
                    (lesson.startTime || "") +
                    (lesson.endTime ? " — " + lesson.endTime : "");
                tdGroup.textContent = lesson.group || "";
                tdSubject.textContent = lesson.subject || "";
                tdTeacher.textContent = lesson.teacher || "";
                tdRoom.textContent = lesson.room || "";

                tdActions.className = "actions-cell";

                var editBtn = document.createElement("button");
                editBtn.type = "button";
                editBtn.textContent = "Изм.";
                editBtn.addEventListener("click", function () {
                    startEditLesson(weekKey, dayKey, lesson);
                });

                var deleteBtn = document.createElement("button");
                deleteBtn.type = "button";
                deleteBtn.textContent = "X";
                deleteBtn.classList.add("secondary");
                deleteBtn.addEventListener("click", function () {
                    deleteLesson(weekKey, dayKey, lesson.id);
                });

                tdActions.appendChild(editBtn);
                tdActions.appendChild(deleteBtn);

                tr.appendChild(tdDay);
                tr.appendChild(tdTime);
                tr.appendChild(tdGroup);
                tr.appendChild(tdSubject);
                tr.appendChild(tdTeacher);
                tr.appendChild(tdRoom);
                tr.appendChild(tdActions);

                scheduleTableBody.appendChild(tr);
            });
        }

        if (!hasLessons) {
            var tr = document.createElement("tr");
            var td = document.createElement("td");
            td.colSpan = 7;
            td.textContent = "Расписание пока пустое для выбранной недели.";
            tr.appendChild(td);
            scheduleTableBody.appendChild(tr);
        }
    }

    function startEditLesson(weekKey, dayKey, lesson) {
        editingWeekKey = weekKey;
        editingDayKey = dayKey;
        editingLessonId = lesson.id;

        scheduleWeekSelect.value = weekKey;
        scheduleDaySelect.value = dayKey;

        scheduleGroupInput.value = lesson.group || "";
        scheduleStartInput.value = lesson.startTime || "";
        scheduleEndInput.value = lesson.endTime || "";
        scheduleSubjectInput.value = lesson.subject || "";
        scheduleTeacherInput.value = lesson.teacher || "";
        scheduleRoomInput.value = lesson.room || "";

        scheduleSaveButton.textContent = "Сохранить изменения";
        scheduleCancelButton.classList.remove("hidden");
        setScheduleStatus("Редактирование пары", false);
    }

    function deleteLesson(weekKey, dayKey, lessonId) {
        if (!currentUniversityId || !lessonId) return;

        var confirmed = window.confirm("Удалить эту пару из расписания?");
        if (!confirmed) return;

        var dayLessons = scheduleByDay[dayKey] || [];
        var updated = dayLessons.filter(function (l) { return l.id !== lessonId; });
        scheduleByDay[dayKey] = updated;

        var dayRef = db
            .collection("universities")
            .doc(currentUniversityId)
            .collection("schedule")
            .doc(weekKey)
            .collection("days")
            .doc(dayKey);

        dayRef
            .set({ lessons: updated }, { merge: true })
            .then(function () {
                setScheduleStatus("Пара удалена", false);
                if (editingLessonId === lessonId) {
                    clearScheduleForm();
                }
                renderScheduleGrouped();
            })
            .catch(function (error) {
                console.error("Ошибка удаления пары:", error);
                setScheduleStatus("Ошибка удаления: " + error.message, true);
            });
    }

    if (scheduleSaveButton) {
        scheduleSaveButton.addEventListener("click", function () {
            if (!currentUniversityId) {
                setScheduleStatus("ID вуза не определён. Войдите заново.", true);
                return;
            }

            var weekKey = editingLessonId ? editingWeekKey : getCurrentWeekKey();
            var day = parseInt(scheduleDaySelect.value, 10);
            var dayKey = editingLessonId ? editingDayKey : String(day);

            var group = scheduleGroupInput.value.trim();
            var startTime = scheduleStartInput.value;
            var endTime = scheduleEndInput.value;
            var subject = scheduleSubjectInput.value.trim();
            var teacher = scheduleTeacherInput.value.trim();
            var room = scheduleRoomInput.value.trim();

            if (!weekKey || !day || !group || !startTime || !subject) {
                setScheduleStatus("Обязательные поля: неделя, день, группа, начало пары, предмет.", true);
                return;
            }

            var lessonId = editingLessonId || generateLessonId();

            var lessonData = {
                id: lessonId,
                group: group,
                startTime: startTime,
                endTime: endTime || "",
                subject: subject,
                teacher: teacher,
                room: room
            };

            var dayLessons = scheduleByDay[dayKey] ? scheduleByDay[dayKey].slice() : [];

            if (editingLessonId) {
                dayLessons = dayLessons.map(function (l) {
                    return l.id === lessonId ? lessonData : l;
                });
            } else {
                dayLessons.push(lessonData);
            }

            scheduleByDay[dayKey] = dayLessons;

            var dayRef = db
                .collection("universities")
                .doc(currentUniversityId)
                .collection("schedule")
                .doc(weekKey)
                .collection("days")
                .doc(dayKey);

            setScheduleStatus("Сохраняем пару...", false);

            dayRef
                .set(
                    {
                        lessons: dayLessons,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    },
                    { merge: true }
                )
                .then(function () {
                    setScheduleStatus("Пара сохранена", false);
                    clearScheduleForm();
                    renderScheduleGrouped();
                })
                .catch(function (error) {
                    console.error("Ошибка сохранения пары:", error);
                    setScheduleStatus("Ошибка сохранения: " + error.message, true);
                });
        });
    }

    if (scheduleCancelButton) {
        scheduleCancelButton.addEventListener("click", function () {
            clearScheduleForm();
        });
    }

    // при смене недели просто перезагружаем расписание
    if (scheduleWeekSelect) {
        scheduleWeekSelect.addEventListener("change", function () {
            clearScheduleForm();
            loadSchedule();
        });
    }

    // При загрузке — форма логина
    showLogin();
})();
