class App {

    constructor() {
        this.pico = new PicoSerial(this.onConnected.bind(this), this.onDisconnected.bind(this), this.log) 
        this.connected = false
        this.running = true
        this.supportedFiles = ['py', 'json', 'txt', 'md', 'ini', 'c']
        this.errorMessages = {39: 'Directory not empty!', 21: 'Directory exists!'}
        this.ignorePatterns = [
            ".git",
            ".github",
            "__pycache__",
            ".DS_Store",
            ".venv",
            "venv",
            ".idea",
            ".vscode"
        ]
    }

    init() {
        this.__onClick("#search", async () => await this.pico.connect())
        this.__onClick("#disconnect", async () => await this.pico.disconnect())
        this.__onClick("#reboot", () => {
            this.running = true
            this.pico.rebootDevice()
            document.querySelector("#tab-files").classList.add('disabled')
        })
        this.__onClick("#stop", () => {
            this.running = false
            this.pico.stopDevice()
            document.querySelector("#tab-files").classList.remove('disabled')
        })
        this.__onClick("#tab-shell", this.showShell.bind(this))
        this.__onClick("#tab-files", this.showFilesTab.bind(this))
        this.__onClick("#save", () => {
            const fileContent = document.querySelector("#file-content")
            this.pico.saveFile(fileContent.dataset.file, fileContent.value, this.onFileSaved.bind(this))
        })
        const actionsMenu = document.querySelector("#actions-menu")
        if (actionsMenu) {
            actionsMenu.addEventListener("change", (e) => {
                const action = e.target.value
                if (action === "create-file") {
                    this.createFile()
                } else if (action === "create-folder") {
                    this.createFolder()
                } else if (action === "delete-all") {
                    this.deleteAll()
                }
                e.target.value = ""
            })
        }
        const uploadMenu = document.querySelector("#upload-menu")
        if (uploadMenu) {
            uploadMenu.addEventListener("change", (e) => {
                const action = e.target.value
                if (action === "upload-files") {
                    const fileInput = document.querySelector("#file-upload")
                    if (fileInput) fileInput.click()
                } else if (action === "upload-folder") {
                    const folderInput = document.querySelector("#folder-upload")
                    if (folderInput) folderInput.click()
                }
                e.target.value = ""
            })
        }
        const folderUploadInput = document.querySelector("#folder-upload")
        if (folderUploadInput) {
            folderUploadInput.addEventListener("change", this.uploadFiles.bind(this))
        }
        const fileUploadInput = document.querySelector("#file-upload")
        if (fileUploadInput) {
            fileUploadInput.addEventListener("change", this.uploadFiles.bind(this))
        }
        window.addEventListener('beforeunload', async () => await this.pico.stop())
    }

    onConnected() {
        this.connected = true
        this.running = true
        this.clearLog()
        this.log(`[Pico connected]\n\n`)
        this.__hide('#search')
        this.__show('[data-connected]')
        this.showShell()
    }

    onDisconnected() {
        this.connected = false
        this.log(`\n[Pico disconnected]\n\n`)
        this.__hide('[data-connected]')
        this.__show('#search')
        this.showShell()
        document.querySelector('#tab-files').classList.add('disabled')
    }

    onFileSaved(message) {
        document.querySelector("#result").textContent = message ? "Saved!" : "Save failed!"
        setTimeout(() => {document.querySelector("#result").textContent = ''}, 3000)
    }

    log(message) {
        let output = document.querySelector('#shell');
        output.value += message;
        output.scrollTop = output.scrollHeight
    }

    clearLog() {
        document.querySelector('#shell').value = '';
    }

    showShell() {
        this.__hide(['#save', '#files'])
        this.__show('#shell')
        if (this.connected) {
            this.__show(['#reboot', '#stop'])
        }
        document.querySelector('#tab-shell').classList.add('active')
        document.querySelector('#tab-files').classList.remove('active')
    }

    showFilesTab() {
        if (!this.connected) return alert('Please connect to Pico!')
        if (this.running) {
            if (window.confirm('Stop Pico?')) {
                this.running = false
                document.querySelector("#tab-files").classList.remove('disabled')
                this.pico.stopDevice()
                this.__show('#files')
                this.__hide(['#shell', '#reboot', '#stop', '#save'])
                document.querySelector('#tab-shell').classList.remove('active')
                document.querySelector('#tab-files').classList.add('active')
                setTimeout(() => {
                    this.pico.listFiles(document.querySelector('#browser').dataset.dir, this.renderFiles.bind(this))
                }, 300)
            }
            return
        }
        this.__show('#files')
        this.__hide(['#shell', '#reboot', '#stop', '#save'])
        this.pico.listFiles(document.querySelector('#browser').dataset.dir, this.renderFiles.bind(this))
        document.querySelector('#tab-shell').classList.remove('active')
        document.querySelector('#tab-files').classList.add('active')
    }

    asyncShowFilesTab(output) {
        if (typeof output == 'string' && output.includes('OSError:')) {
            this.throwError(output)
        } else {
            setTimeout(this.showFilesTab.bind(this), 100)
        }
    }

    throwError(output) {
        const match = output.match(/OSError:.* (\d+)/)
        var message = 'Unknown error occured!'
        if (match && match[1]) {
            message = this.errorMessages[parseInt(match[1])] || message
        } 
        alert('Error: ' + message)
    }

    renderFiles(response) {
        const files = response == true ? [] : response.split('\n')
        const fileBrowser = document.querySelector('#browser')
        const currentDir = fileBrowser.dataset.dir

        fileBrowser.innerHTML = ''
        if (currentDir.split('/').length > 2) files.unshift('..|True|0')
    
        files.forEach(file => {
            const [name, isDir, size] = file.split('|')
            const fileLink = this.__createNode("a", 'file')
            fileLink.innerHTML = (isDir == 'True' ? '&#128193; ' : '&#128221; ')  + name
            if (isDir == 'True') {
                fileLink.onclick = () => {
                    if (name == '..') {
                         const pathComponents = fileBrowser.dataset.dir.split('/')
                         pathComponents.pop()
                         pathComponents.pop()
                         fileBrowser.dataset.dir = pathComponents.join('/') + '/'
                    } else {
                        fileBrowser.dataset.dir = fileBrowser.dataset.dir + name + '/'
                    }
                    this.pico.listFiles(fileBrowser.dataset.dir, this.renderFiles.bind(this))
                }
            } else {
                const filePath = fileBrowser.dataset.dir + name
                const nameParts = name.split('.')
                if (nameParts.length >1 && this.supportedFiles.indexOf(nameParts.pop().toLowerCase()) >= 0) {
                    fileLink.onclick = this.pico.readFile.bind(this.pico, filePath, this.renderFileContent.bind(this, filePath, fileLink))
                } else {
                    fileLink.classList.add('disabled')
                }
            }
            const fileEntry = fileBrowser.appendChild(this.__createNode('div', 'file-entry'))
            fileEntry.appendChild(fileLink)
            fileEntry.appendChild(this.__createNode('span', 'file-action', '&#9999;&#65039;', "Rename", this.renameFile.bind(this, name)))
            fileEntry.appendChild(this.__createNode('span', 'file-action', '&#10060;', "Delete", this.deleteFile.bind(this, name)))
        })
        document.querySelector('#file-content').value = ''
        document.querySelector('#file-content').placeholder = ''
        this.__hide('#save')
    }

    renderFileContent(file, fileNode, content) {
        document.querySelectorAll('.file').forEach(node => {
            node.classList.remove('selected')
        })
        fileNode && fileNode.classList.add('selected')
        this.__show('#save')
        document.querySelector('#file-content').dataset.file = file
        if (content == true){
            document.querySelector('#file-content').placeholder = '(empty)'
        } else {
            document.querySelector('#file-content').value = content
        }
    }

    createFile() {
        const newFile = window.prompt("Name of new file:")
        if (!newFile) return
        const filePath = document.querySelector('#browser').dataset.dir + newFile
        this.pico.createFile(filePath, this.asyncShowFilesTab.bind(this))
    }

    createFolder() {
        const newFile = window.prompt("Name of new folder:")
        if (!newFile) return
        const filePath = document.querySelector('#browser').dataset.dir + newFile
        this.pico.createFolder(filePath, this.asyncShowFilesTab.bind(this))
    }

    deleteFile(name) {
        if (window.confirm("Delete file '" + name + "'?")) {
            const filePath = document.querySelector('#browser').dataset.dir + name
            this.pico.deleteFile(filePath, this.asyncShowFilesTab.bind(this))
        }
    }

    renameFile(name) {
        const newName = window.prompt("Rename file", name)
        if (newName != '' && !newName.includes('/')) {
            const srcPath = document.querySelector('#browser').dataset.dir + name
            const targetPath = document.querySelector('#browser').dataset.dir + newName
            this.pico.renameFile(srcPath, targetPath, this.asyncShowFilesTab.bind(this))
        }
    }

    __createNode(tag, className, innerHTML = null, title = null, onclick = null) {
        const newNode = document.createElement(tag)
        newNode.classList.add(className)
        innerHTML && (newNode.innerHTML = innerHTML)
        title && (newNode.title = title)
        newNode.onclick = onclick
        return newNode
    }

    __onClick(selector, callback) {
        const node = document.querySelector(selector)
        node && node.addEventListener("click", callback)
    }

    __show(selectors) {
        if (!Array.isArray(selectors)) selectors = [selectors]
        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(node => {
                node.classList.remove('hidden')
            })
        })
    }

    __hide(selectors) {
        if (!Array.isArray(selectors)) selectors = [selectors]
        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(node => {
                node.classList.add('hidden')
            })
        })
    }

    isIgnored(relativePath) {
        const parts = relativePath.split('/');
        for (const part of parts) {
            if (!part) continue;
            if (this.ignorePatterns.includes(part)) return true;
            if (part.endsWith('.pyc') || part.endsWith('.swp') || part.endsWith('~')) return true;
        }
        return false;
    }

    async uploadFiles(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const fileBrowser = document.querySelector('#browser');
        const currentDir = fileBrowser.dataset.dir;
        const resultSpan = document.querySelector("#result");

        // Filter files to upload
        const filesToUpload = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const checkPath = file.webkitRelativePath || file.name;
            if (checkPath && !this.isIgnored(checkPath)) {
                filesToUpload.push(file);
            }
        }

        if (filesToUpload.length === 0) {
            resultSpan.textContent = "No valid files to upload.";
            setTimeout(() => { resultSpan.textContent = ''; }, 3000);
            return;
        }

        resultSpan.textContent = `Preparing to upload ${filesToUpload.length} file(s)...`;

        try {
            // Keep track of directories we already created during this upload to avoid redundant serial calls
            const createdDirs = new Set();

            for (let i = 0; i < filesToUpload.length; i++) {
                const file = filesToUpload[i];
                let relativePath = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
                if (file.webkitRelativePath) {
                    const pathParts = relativePath.split('/');
                    pathParts.shift(); // Remove the top-level root folder
                    relativePath = pathParts.join('/');
                }
                const targetPath = currentDir + relativePath;

                // Determine parent directory path
                const parts = targetPath.split('/');
                parts.pop(); // Remove the filename to get parent dir
                const parentDir = parts.join('/');

                resultSpan.textContent = `Uploading [${i + 1}/${filesToUpload.length}]: ${file.name}...`;

                // Recursively create directory on Pico if not already created/root
                if (parentDir && parentDir !== '/' && !createdDirs.has(parentDir)) {
                    await this.pico.createFolderRecursive(parentDir);
                    createdDirs.add(parentDir);
                }

                // Read file content as ArrayBuffer
                const fileBuffer = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(reader.error);
                    reader.readAsArrayBuffer(file);
                });

                // Write file to Pico
                await this.pico.uploadFile(targetPath, fileBuffer);
            }

            resultSpan.textContent = `Uploaded ${filesToUpload.length} file(s) successfully!`;
            setTimeout(() => { resultSpan.textContent = ''; }, 5000);

            // Refresh directory list
            this.showFilesTab();
        } catch (error) {
            console.error('Upload error:', error);
            resultSpan.textContent = `Upload failed: ${error}`;
            alert(`Error during upload: ${error}`);
        } finally {
            event.target.value = '';
        }
    }

    deleteAll() {
        const currentDir = document.querySelector('#browser').dataset.dir
        if (window.confirm("Delete all files inside '" + currentDir + "' recursively? This cannot be undone.")) {
            this.pico.deleteAllRecursive(currentDir, this.asyncShowFilesTab.bind(this))
        }
    }
}
