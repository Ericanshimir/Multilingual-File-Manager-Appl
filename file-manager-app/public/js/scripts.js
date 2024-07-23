document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(registerForm);
            const response = await fetch('/register', {
                method: 'POST',
                body: new URLSearchParams(formData)
            });
            if (response.ok) {
                document.getElementById('registerSuccess').style.display = 'block';
                registerForm.reset();
            } else {
                // Handle registration error
            }
        });
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(loginForm);
            const response = await fetch('/login', {
                method: 'POST',
                body: new URLSearchParams(formData)
            });
            if (response.ok) {
                window.location.href = '/dashboard.html';
            } else {
                document.getElementById('loginError').style.display = 'block';
            }
        });
    }

    const logoutButton = document.getElementById('logout');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            await fetch('/logout', { method: 'POST' });
            window.location.href = '/login.html';
        });
    }

    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(uploadForm);
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            if (response.ok) {
                alert('File uploaded successfully');
                uploadForm.reset();
            } else {
                alert('File upload failed');
            }
        });
    }

    const fileList = document.getElementById('fileList');
    if (fileList) {
        fetch('/files')
            .then(response => response.json())
            .then(files => {
                files.forEach(file => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${file.id}</td>
                        <td>${file.name}</td>
                        <td>${file.size}</td>
                        <td>${file.type}</td>
                        <td>
                            <a href="update-file.html?id=${file.id}" class="btn btn-sm btn-warning">Update</a>
                            <button class="btn btn-sm btn-danger delete-file" data-id="${file.id}">Delete</button>
                        </td>
                    `;
                    fileList.appendChild(row);
                });

                document.querySelectorAll('.delete-file').forEach(button => {
                    button.addEventListener('click', async (e) => {
                        const fileId = e.target.getAttribute('data-id');
                        const response = await fetch(`/files/${fileId}`, { method: 'DELETE' });
                        if (response.ok) {
                            alert('File deleted successfully');
                            window.location.reload();
                        } else {
                            alert('Failed to delete file');
                        }
                    });
                });
            });
    }

    const updateFileForm = document.getElementById('updateFileForm');
    if (updateFileForm) {
        const params = new URLSearchParams(window.location.search);
        const fileId = params.get('id');
        
        updateFileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newFilename = document.getElementById('newFilename').value;
            const response = await fetch(`/files/${fileId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: newFilename })
            });
            if (response.ok) {
                alert('File updated successfully');
                window.location.href = '/files.html';
            } else {
                alert('Failed to update file');
            }
        });
    }
});
document.getElementById('logout').addEventListener('click', function() {
    fetch('/logout', {
        method: 'POST',
        credentials: 'same-origin'
    }).then(response => {
        if (response.ok) {
            window.location.href = '/login.html';
        }
    });
});
