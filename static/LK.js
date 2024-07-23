document.addEventListener('DOMContentLoaded', function () {
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }

    function decodeToken(token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload;
        } catch (e) {
            console.error('Ошибка декодирования токена:', e);
            return null;
        }
    }

    function isTokenExpired(token) {
        const payload = decodeToken(token);
        if (payload && payload.exp) {
            const expiryDate = new Date(payload.exp * 1000);
            return new Date() > expiryDate;
        }
        return true;
    }

    function redirectToLogin() {
        window.location.href = '/index.html';
    }

    const Token = getCookie('access_token');

    if (Token && isTokenExpired(Token)) {
        redirectToLogin();
    }

    const currentTasks = document.getElementById('current-tasks');
    const completedTasks = document.getElementById('completed-tasks');
    const saveTaskBtn = document.getElementById('save-task-btn');
    const createTaskModalBtn = document.getElementById('create-task-modal-btn');
    const editModal = document.getElementById('exampleModalEdit') ? new bootstrap.Modal(document.getElementById('exampleModalEdit')) : null;
    const createModal = document.getElementById('exampleModalCreate') ? new bootstrap.Modal(document.getElementById('exampleModalCreate')) : null;
    const deleteModal = document.getElementById('deleteModal') ? new bootstrap.Modal(document.getElementById('deleteModal')) : null;
    const completeModal = document.getElementById('exampleModalComplete') ? new bootstrap.Modal(document.getElementById('exampleModalComplete')) : null;
    const resumeModal = document.getElementById('exampleModalResume') ? new bootstrap.Modal(document.getElementById('exampleModalResume')) : null;
    const viewModal = document.getElementById('exampleModalView') ? new bootstrap.Modal(document.getElementById('exampleModalView')) : null;

    const urlParams = new URLSearchParams(window.location.search);
    const taskId = urlParams.get('task_id');
    const category = urlParams.get('category');
    const token = getCookie('access_token');

    let currentCategory = category === 'completed_tasks' ? 'tasks_completed' : 'tasks';

    if (currentTasks) {
        currentTasks.addEventListener('click', function () {
            if (!currentTasks.classList.contains('underline')) {
                currentTasks.classList.add('underline');
                completedTasks.classList.remove('underline');
                currentCategory = 'tasks';
                showTasks(currentCategory);
            }
        });
    }

    if (completedTasks) {
        completedTasks.addEventListener('click', function () {
            if (!completedTasks.classList.contains('underline')) {
                completedTasks.classList.add('underline');
                currentTasks.classList.remove('underline');
                currentCategory = 'tasks_completed';
                showTasks(currentCategory);
            }
        });
    }

    async function showTasks(category) {
        if (!token) {
            console.error('Токен не найден, пользователь не аутентифицирован');
            return;
        }

        const url = category === 'tasks' ? '/tasks' : '/tasks_completed';

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const tasks = await response.json();
                const tasksContainer = document.getElementById('task-list');
                if (tasksContainer) {
                    tasksContainer.innerHTML = '';
                    tasks.forEach(task => {
                        if ((category === 'tasks' && !task.completed) || (category === 'tasks_completed' && task.completed)) {
                            const taskElement = createTaskElement(task);
                            tasksContainer.appendChild(taskElement);
                        }
                    });
                }
            } else {
                console.error('Ошибка при получении задач:', response.statusText);
            }
        } catch (error) {
            console.error('Ошибка при получении задач:', error);
        }
    }

    async function fetchTaskDetails(taskId, isEditing = false) {
        if (!token) {
            console.error('Токен не найден, пользователь не аутентифицирован');
            return;
        }
    
        try {
            const response = await fetch(`/tasks/${taskId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
    
            if (response.ok) {
                const task = await response.json();
                if (task) {
                    if (isEditing && editModal) {
                        document.getElementById('recipient-name-edit').value = task.heading || '';
                        document.getElementById('message-text-edit').value = task.task_text || '';
                        document.getElementById('task_id').value = task.task_id || '';
                        editModal.show();
                    } else if (viewModal) {
                        document.getElementById('exampleModalLabelView').textContent = task.heading || '';
                        document.getElementById('message-text-view').textContent = task.task_text || '';
                        viewModal.show();
                    }
                }
            } else {
                console.error('Ошибка при получении задачи:', response.statusText);
            }
        } catch (error) {
            console.error('Ошибка при получении задачи:', error);
        }
    }        

    async function saveTask(isEditing = false, taskId = null, heading = '', taskText = '') {
        if (!token) {
            console.error('Токен не найден, пользователь не аутентифицирован');
            return;
        }
    
        // Проверка на пустые поля при редактировании
        if (isEditing && (!heading || !taskText || !taskId)) {
            console.error('Название, текст задачи или ID не могут быть пустыми при редактировании');
            return;
        }
    
        const taskData = {
            heading,
            task_text: taskText
        };
    
        try {
            const response = await fetch(isEditing && taskId ? `/tasks/${taskId}` : '/create_task', {
                method: isEditing && taskId ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(taskData)
            });
    
            if (response.ok) {
                const result = await response.json();
                console.log('Задача успешно сохранена:', result);
                showTasks(currentCategory); // Обновляем список задач
                if (editModal) {
                    editModal.hide(); // Закрываем модальное окно редактирования
                }
            } else {
                console.error('Ошибка при сохранении задачи:', response.statusText);
            }
        } catch (error) {
            console.error('Ошибка при сохранении задачи:', error);
        }
    }    
    
    const createModalElement = document.getElementById('exampleModalCreate');
    const createTaskBtn = document.getElementById('create-task-btn');

    createTaskBtn.addEventListener('click', createTask);

    createModalElement.addEventListener('hidden.bs.modal', () => {
        document.getElementById('recipient-name-create').value = '';
        document.getElementById('message-text-create').value = '';
    });

    async function createTask() {
        if (!token) {
            console.error('Токен не найден, пользователь не аутентифицирован');
            return;
        }

        const heading = document.getElementById('recipient-name-create').value.trim();
        const task_text = document.getElementById('message-text-create').value.trim();

        if (!heading || !task_text) {
            console.error('Название и текст задачи не могут быть пустыми');
            document.getElementById('error-message-create').classList.remove('d-none');
            return;
        }

        document.getElementById('error-message-create').classList.add('d-none');

        const taskData = {
            heading,
            task_text
        };

        try {
            const response = await fetch('/create_task', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(taskData)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Задача успешно создана:', result);
                showTasks(currentCategory);

                // Скрываем модальное окно после успешного создания задачи
                const bootstrapModal = bootstrap.Modal.getInstance(createModalElement);
                bootstrapModal.hide();
            } else {
                console.error('Ошибка при создании задачи:', response.statusText);
            }
        } catch (error) {
            console.error('Ошибка при создании задачи:', error);
        }
    }

    async function deleteTask(taskId) {
        if (!token) {
            console.error('Токен не найден, пользователь не аутентифицирован');
            return;
        }

        try {
            const response = await fetch(`/tasks/${taskId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                console.log(`Задача ${taskId} успешно удалена`);
                showTasks(currentCategory); // Обновляем список задач
            } else {
                console.error('Не удалось удалить задачу:', response.statusText);
            }
        } catch (error) {
            console.error('Ошибка при удалении задачи:', error);
        }
    }

    async function completeTask(taskId) {
        if (!token) {
            console.error('Токен не найден, пользователь не аутентифицирован');
            return;
        }

        try {
            const response = await fetch(`/tasks/${taskId}/complete`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ completed: true })
            });

            if (response.ok) {
                console.log('Задача успешно завершена');
                showTasks(currentCategory);
            } else {
                console.error('Ошибка при завершении задачи:', response.statusText);
            }
        } catch (error) {
            console.error('Ошибка при завершении задачи:', error);
        }
    }

    async function resumeTask(taskId) {
        if (!token) {
            console.error('Токен не найден, пользователь не аутентифицирован');
            return;
        }

        try {
            const response = await fetch(`/tasks/${taskId}/resume`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ completed: false })
            });

            if (response.ok) {
                console.log('Задача успешно возобновлена');
                showTasks(currentCategory);
            } else {
                console.error('Ошибка при возобновлении задачи:', response.statusText);
            }
        } catch (error) {
            console.error('Ошибка при возобновлении задачи:', error);
        }
    }

    if (saveTaskBtn) {
        saveTaskBtn.addEventListener('click', saveTask);
    }

    document.getElementById('save-task-btn')?.addEventListener('click', function () {
        const heading = document.getElementById('recipient-name-edit').value.trim();
        const task_text = document.getElementById('message-text-edit').value.trim();
        const task_id = document.getElementById('task_id').value;
    
        if (!heading || !task_text) {
            document.getElementById('error-message-edit').classList.remove('d-none');
            return;
        } else {
            document.getElementById('error-message-edit').classList.add('d-none');
        }
    
        saveTask(true, task_id, heading, task_text); // true означает редактирование задачи
    });    

    document.getElementById('create-task-btn')?.addEventListener('click', function () {
        createTask();
    });

    if (taskId) {
        fetchTaskDetails(taskId);
    }

    showTasks(currentCategory);

    function createTaskElement(task) {
        const taskElement = document.createElement('div');
        taskElement.classList.add('task', 'mb-4');
        taskElement.innerHTML = `
            <div class="d-flex flex-column flex-sm-row justify-content-between">
                <div class="h4 h5-sm h4-md">
                    <strong class="task-name" style="cursor: pointer;">${task.heading}</strong><br>
                    <span class="task-description d-none">${task.task_text}</span>
                </div>
                <div class="d-flex flex-column flex-sm-row">
                    <span class="h4 h5-sm h4-md mb-2 mb-sm-0 me-sm-3 ms-sm-3 edit-task" style="cursor: pointer; color: lime;">Редактировать</span>
                    <span class="h4 h5-sm h4-md mb-2 mb-sm-0 me-sm-3 ms-sm-3 delete-task" style="cursor: pointer; color: red;">Удалить</span>
                    ${task.completed ? '<span class="h4 h5-sm h4-md ms-sm-3 resume-task" style="cursor: pointer; color: #40E0D0;">Возобновить</span>' : '<span class="h4 h5-sm h4-md ms-sm-3 complete-task" style="cursor: pointer; color: #40E0D0;">Завершить</span>'}
                </div>
            </div>
        `;

        taskElement.querySelector('.task-name')?.addEventListener('click', function (event) {
            event.stopPropagation();
            fetchTaskDetails(task.task_id, false); // false, если нужно просто просмотреть задачу
        });
        
        taskElement.querySelector('.edit-task')?.addEventListener('click', function (event) {
            event.stopPropagation();
            fetchTaskDetails(task.task_id, true); // true, если нужно редактировать задачу
        });        

        taskElement.querySelector('.delete-task')?.addEventListener('click', function (event) {
            event.stopPropagation();
            const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
            const deleteTaskTitle = document.getElementById('delete-task-title');
            if (confirmDeleteBtn) {
                confirmDeleteBtn.dataset.taskId = task.task_id;
            }
            if (deleteTaskTitle) {
                deleteTaskTitle.textContent = task.heading;
            }
            if (deleteModal) {
                deleteModal.show();
            }
        });

        taskElement.querySelector('.complete-task')?.addEventListener('click', function (event) {
            event.stopPropagation();
            const confirmCompleteBtn = document.getElementById('confirmCompleteBtn');
            const completeTaskTitle = document.getElementById('complete-task-title');
            if (confirmCompleteBtn) {
                confirmCompleteBtn.dataset.taskId = task.task_id;
            }
            if (completeTaskTitle) {
                completeTaskTitle.textContent = task.heading; // Устанавливаем название задачи
            }
            if (completeModal) {
                completeModal.show();
            }
        });

        taskElement.querySelector('.resume-task')?.addEventListener('click', function (event) {
            event.stopPropagation();
            const confirmResumeBtn = document.getElementById('confirmResumeBtn');
            const resumeTaskTitle = document.getElementById('resume-task-title');
            if (confirmResumeBtn) {
                confirmResumeBtn.dataset.taskId = task.task_id;
            }
            if (resumeTaskTitle) {
                resumeTaskTitle.textContent = task.heading; // Устанавливаем название задачи
            }
            if (resumeModal) {
                resumeModal.show();
            }
        });

        return taskElement;
    }

    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', function () {
            const taskId = confirmDeleteBtn.dataset.taskId;
            deleteTask(taskId);
            if (deleteModal) {
                deleteModal.hide();
            }
        });
    }

    const confirmCompleteBtn = document.getElementById('confirmCompleteBtn');
    if (confirmCompleteBtn) {
        confirmCompleteBtn.addEventListener('click', function () {
            const taskId = confirmCompleteBtn.dataset.taskId;
            completeTask(taskId);
            if (completeModal) {
                completeModal.hide();
            }
        });
    }

    const confirmResumeBtn = document.getElementById('confirmResumeBtn');
    if (confirmResumeBtn) {
        confirmResumeBtn.addEventListener('click', function () {
            const taskId = confirmResumeBtn.dataset.taskId;
            resumeTask(taskId);
            if (resumeModal) {
                resumeModal.hide();
            }
        });
    }
});
