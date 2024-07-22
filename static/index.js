document.addEventListener('DOMContentLoaded', function() {
    // Находим элементы
    const toggleText = document.querySelector('.toggle-text');
    const ramText = document.querySelector('.ram-text');

    // Скрываем текст при загрузке страницы
    ramText.style.display = 'none';

    // Добавляем обработчик события клика
    toggleText.addEventListener('click', function() {
        // Переключаем видимость текста и изменяем иконку
        ramText.style.display = ramText.style.display === 'none' ? 'block' : 'none';
        const toggleIcon = toggleText.querySelector('.toggle-icon');
        toggleIcon.textContent = ramText.style.display === 'none' ? '+' : '-';
    });
});
///////////////////////////////////////////////////////////////////////////////////////

// Обработчик для формы входа
function checkLogin(event) {
    event.preventDefault();
    
    var login = document.getElementById("login_login").value;
    var password = document.getElementById("login_password").value;
    var loginInput = document.getElementById("login_login");
    var passwordInput = document.getElementById("login_password");
    var loginMessage = document.getElementById("loginMessage");

    if (login.length > 0 && password.length > 0) {
        var zapros = new XMLHttpRequest();
        zapros.open("POST", "/auth", true);
        zapros.setRequestHeader("Content-Type", "application/json");

        zapros.onload = function () {
            if (zapros.status === 200) {
                var response = JSON.parse(zapros.responseText);
                if (response.access_token) {
                    document.cookie = "access_token=" + response.access_token + "; path=/; max-age=3600";
                    localStorage.setItem('access_token', response.access_token);
                    window.location.href = "LK.html";
                } else {
                    console.error('Токен доступа не получен:', response);
                }
            } else if (zapros.status === 401) { // Обработка ошибки авторизации
                try {
                    var errorResponse = JSON.parse(zapros.responseText);
                    if (errorResponse.error) {
                        loginMessage.textContent = "Ошибка: " + errorResponse.error;
                    } else {
                        loginMessage.textContent = "Неверный логин или пароль!";
                    }
                    loginMessage.classList.add("alert", "alert-danger");
                } catch (e) {
                    loginMessage.textContent = "Произошла неизвестная ошибка.";
                    loginMessage.classList.add("alert", "alert-danger");
                }
            } else {
                loginMessage.textContent = "Произошла ошибка при обработке запроса.";
                loginMessage.classList.add("alert", "alert-danger");
            }
        };
        
        zapros.onerror = function () {
            loginMessage.textContent = "Произошла ошибка при отправке запроса.";
            loginMessage.classList.add("alert", "alert-danger");
        };

        zapros.send(JSON.stringify({ login: login, password: password }));
    } else {
        loginMessage.textContent = "Пожалуйста, заполните все поля.";
        loginMessage.classList.add("alert", "alert-danger");
    }
}

// Обработчик для формы регистрации
function checkRegis(event) {
    event.preventDefault();

    var login = document.getElementById("register_login").value;
    var password = document.getElementById("register_password").value;
    var registerMessage = document.getElementById("registerMessage");

    if (login.length > 0 && password.length > 0) {
        var zapros = new XMLHttpRequest();
        zapros.open("POST", "/registration", true);
        zapros.setRequestHeader("Content-Type", "application/json");

        zapros.onload = function () {
            if (zapros.status === 200) {
                registerMessage.textContent = "Регистрация прошла успешно!";
                registerMessage.classList.remove("alert-danger");
                registerMessage.classList.add("alert", "alert-success");
            } else if (zapros.status === 400) { // Обработка ошибки при дублировании логина
                try {
                    var errorResponse = JSON.parse(zapros.responseText);
                    if (errorResponse.error) {
                        registerMessage.textContent = errorResponse.error;
                        registerMessage.classList.remove("alert-success");
                        registerMessage.classList.add("alert", "alert-danger");
                    } else {
                        registerMessage.textContent = "Произошла ошибка при обработке запроса.";
                        registerMessage.classList.remove("alert-success");
                        registerMessage.classList.add("alert", "alert-danger");
                    }
                } catch (e) {
                    registerMessage.textContent = "Произошла неизвестная ошибка.";
                    registerMessage.classList.remove("alert-success");
                    registerMessage.classList.add("alert", "alert-danger");
                }
            } else {
                registerMessage.textContent = "Произошла ошибка при обработке запроса.";
                registerMessage.classList.remove("alert-success");
                registerMessage.classList.add("alert", "alert-danger");
            }
        };
        
        zapros.onerror = function () {
            registerMessage.textContent = "Произошла ошибка при отправке запроса.";
            registerMessage.classList.remove("alert-success");
            registerMessage.classList.add("alert", "alert-danger");
        };

        zapros.send(JSON.stringify({
            login: login,
            password: password
        }));
    } else {
        registerMessage.textContent = "Пожалуйста, заполните все поля.";
        registerMessage.classList.remove("alert-success");
        registerMessage.classList.add("alert", "alert-danger");
    }
}

// Привязка обработчиков к формам
document.getElementById("loginForm").addEventListener("submit", checkLogin);
document.getElementById("registerForm").addEventListener("submit", checkRegis);