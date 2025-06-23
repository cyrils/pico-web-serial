class App {

    constructor() {
        this.pico = new PicoSerial(this.onConnected.bind(this), this.onDisconnected.bind(this), this.log) 
        this.connected = false
        this.running = true
        this.supportedFiles = ['py', 'json', 'txt', 'md', 'ini', 'c']
    }

    init() {
        document.querySelector("#search").addEventListener("click", async () => await this.pico.connect());
        document.querySelector("#disconnect").addEventListener("click", async () => await this.pico.disconnect());
        document.querySelector("#reboot").addEventListener("click", () => {
            this.running = true
            this.pico.rebootDevice()
            document.querySelector("#tab-files").classList.add('disabled')
        });
        document.querySelector("#stop").addEventListener("click", () => {
            this.running = false
            this.pico.stopDevice()
            document.querySelector("#tab-files").classList.remove('disabled')
        });
        document.querySelectorAll(".tab").forEach(tab => {
            tab.addEventListener("click", () => {
                if (tab.classList.contains('disabled')) return
                document.querySelectorAll(".tab").forEach(node => {
                    node.classList.remove("active")
                })
                tab.classList.add("active")
            })
        })
        document.querySelector("#tab-shell").addEventListener("click", this.showShell.bind(this));
        document.querySelector("#tab-files").addEventListener("click", this.showFilesTab.bind(this));
        window.addEventListener('beforeunload', async () => await this.pico.stop());
        document.querySelector("#save").addEventListener("click", () => {
            const fileContent = document.querySelector("#file-content")
            this.pico.saveFile(fileContent.dataset.file, fileContent.value, this.onFileSaved.bind(this))
        })
        document.querySelector("#create-file").addEventListener("click", this.createFile.bind(this))
        document.querySelector("#create-folder").addEventListener("click", this.createFolder.bind(this))
    }

    onConnected() {
        this.connected = true
        this.clearLog()
        this.log(`[Pico connected]\n\n`)
        document.querySelector('#search').classList.add('hidden')
        document.querySelectorAll('[data-connected]').forEach(element => {
            element.classList.remove('hidden')
        })
        this.showShell()
    }

    onDisconnected() {
        this.connected = false
        this.log(`\n[Pico disconnected]\n\n`)
        document.querySelectorAll('[data-connected]').forEach(element => {
            element.classList.add('hidden')
        });
        document.querySelector('#search').classList.remove('hidden');
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
        document.querySelector("#save").classList.add('hidden')
        document.querySelector("#files").classList.add('hidden')
        document.querySelector("#shell").classList.remove('hidden')
        if (this.connected) {
            document.querySelector("#reboot").classList.remove('hidden')
            document.querySelector("#stop").classList.remove('hidden')
        }
    }

    showFilesTab() {
        if (!this.connected || this.running) return alert('Press Stop button')
        document.querySelector("#files").classList.remove('hidden')
        document.querySelector("#shell").classList.add('hidden')
        document.querySelector("#reboot").classList.add('hidden')
        document.querySelector("#stop").classList.add('hidden')
        
        this.pico.listFiles(document.querySelector('#browser').dataset.dir, this.renderFiles.bind(this))
    }

    asyncShowFilesTab() {
        setTimeout(this.showFilesTab.bind(this), 100)
    }

    renderFiles(response) {
        const files = response == true ? [] : response.split('\n')
        const fileBrowser = document.querySelector('#browser')
        // const selectedFile = document.querySelector('#file-content').dataset.file
        const currentDir = fileBrowser.dataset.dir

        fileBrowser.innerHTML = ''
        if (currentDir.split('/').length > 2) files.unshift('..|True|0')
    
        files.forEach(file => {
            const [name, isDir, size] = file.split('|')
            const fileLink = this.__createNode("a", 'file')
            fileLink.innerHTML = (isDir == 'True' ? '&#128193; ' : '&#128196; ')  + name
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
        document.querySelector("#save").classList.add('hidden')
    }

    renderFileContent(file, fileNode, content) {
        document.querySelectorAll('.file').forEach(node => {
            node.classList.remove('selected')
        })
        fileNode && fileNode.classList.add('selected')
        document.querySelector("#save").classList.remove('hidden')
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
        this.pico.createFile(filePath, (() => {
            setTimeout(this.showFilesTab.bind(this), 100)
        }).bind(this))
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
            this.pico.deleteFile(filePath, this.asyncShowFilesTab.bind(this).bind(this))
        }
    }

    renameFile(name) {
        const newName = window.prompt("Rename file", name)
        if (newName != '' && !newName.includes('/')) {
            const srcPath = document.querySelector('#browser').dataset.dir + name
            const targetPath = document.querySelector('#browser').dataset.dir + newName
            this.pico.renameFile(srcPath, targetPath, this.asyncShowFilesTab.bind(this).bind(this))
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
}
