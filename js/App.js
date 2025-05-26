class App {

    constructor() {
        this.pico = new PicoSerial(this.onConnected.bind(this), this.onDisconnected.bind(this), this.log) 
        this.connected = false
        this.running = true
    }

    init() {
        document.querySelector("#search").addEventListener("click", async () => await this.pico.connect());
        document.querySelector("#disconnect").addEventListener("click", async () => await this.pico.disconnect());
        document.querySelector("#reboot").addEventListener("click", () => {
            this.running = true
            this.pico.rebootDevice()
        });
        document.querySelector("#stop").addEventListener("click", () => {
            this.running = false
            this.pico.stopDevice()
        });
        document.querySelectorAll(".tab").forEach(tab => {
            tab.addEventListener("click", () => {
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
        document.querySelector("#files").classList.remove('hidden')
        document.querySelector("#shell").classList.add('hidden')
        document.querySelector("#reboot").classList.add('hidden')
        document.querySelector("#stop").classList.add('hidden')
        if (this.connected && !this.running) this.pico.listFiles(document.querySelector('#browser').dataset.dir, this.renderFiles.bind(this))
    }

    renderFiles(files) {
        const fileBrowser = document.querySelector('#browser')
        fileBrowser.innerHTML = ''
        if (!Array.isArray(files)) files = []
        if (fileBrowser.dataset.dir.split('/').length > 2) files.unshift('..|True|0')

        files.forEach(file => {
            const [name, isDir, size] = file.split('|')
            const fileLink = document.createElement("a")
            fileLink.classList.add('file')
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
                fileLink.onclick = this.pico.readFile.bind(this.pico, filePath, this.renderFileContent.bind(this, filePath))
            }
            fileBrowser.appendChild(fileLink)
        })
    }

    renderFileContent(file, content) {
        document.querySelector("#save").classList.remove('hidden')
        document.querySelector('#file-content').dataset.file = file
        document.querySelector('#file-content').value = content.join('\n')
    }
}
