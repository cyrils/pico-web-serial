class App {

    constructor() {
        this.pico = new PicoSerial(this.onConnected.bind(this), this.onDisconnected.bind(this), this.log) 
        this.connected = false
    }

    init() {
        document.querySelector("#search").addEventListener("click", async () => await this.pico.connect());
        document.querySelector("#disconnect").addEventListener("click", async () => await this.pico.disconnect());
        document.querySelector("#reboot").addEventListener("click", this.pico.rebootDevice.bind(this.pico));
        document.querySelector("#stop").addEventListener("click", this.pico.stopDevice.bind(this.pico));
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
        if (this.connected) this.pico.listFiles(this.renderFiles.bind(this))
    }

    renderFiles(files) {
        const fileBrowser = document.querySelector('#browser')
        fileBrowser.innerHTML = ''
        files.forEach(file => {
            const fileLink = document.createElement("a")
            fileLink.classList.add('file')
            fileLink.innerHTML = "&#128221; " + file
            fileLink.onclick = this.pico.readFile.bind(this.pico, file, this.renderFileContent.bind(this, file))
            fileBrowser.appendChild(fileLink)
        })
    }

    renderFileContent(file, content) {
        document.querySelector("#save").classList.remove('hidden')
        document.querySelector('#file-content').dataset.file = file
        document.querySelector('#file-content').value = content.join('\n')
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    new App().init()
});