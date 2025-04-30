const VENDOR_ID = 0x2E8A

class PicoSerial {
  constructor() {
    this.pico = null
    this.reading = true
    this.textDecoder = new TextDecoder()
  }

  async start() {
    if (!navigator.serial) {
      alert("Your browser doesn't support connecting to the Pico (the web serial API)")
    } else {
      this.pico = await navigator.serial.requestPort({ filters: [{ usbVendorId: VENDOR_ID }] })
      if (this.pico) await this.openPico()
    }
  }

  async openPico() {
    if (this.pico) await this.pico.open({ baudRate: 115200 })
    this.onConnect()
    this.log(`[Pico connected]\n\n`)
    this.reader = this.pico.readable.getReader()
    setTimeout(this.readFromPico.bind(this), 10)
    this.pico.addEventListener('disconnect', this.onDisconnect.bind(this))
  }

  onConnect() {
    this.clearLog()
    document.querySelectorAll(".hide").forEach(node => {
      node.classList.remove('hidden');
    })
    document.querySelector('#search').classList.add('hidden');
  }

  onDisconnect() {
    this.pico = null
    this.log(`\n[Pico disconnected]\n\n`)
    document.querySelector('#disconnect').classList.add('hidden');
    document.querySelector('#search').classList.remove('hidden');
  }

  log(message) {
    let output = document.querySelector('#log');
    output.value += message;
    output.scrollTop = output.scrollHeight
  }

  clearLog() {
    document.querySelector('#log').value = '';
  }

  async readFromPico() {
    this.reading = true
    try {
      while (this.reading) {
        const { value } = await this.reader.read()
        const output = this.textDecoder.decode(value);
        this.log(output)
      }
    } catch (e) {
      console.log('Read from Pico error', e)
    } finally {
      this.reader.releaseLock()
    }
  }

  async stop() {
    this.reading = false
    await this.reader.cancel()
    await this.reader.releaseLock()
    await this.pico.close()
    this.onDisconnect()
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  let app = new PicoSerial();

  document.querySelector("#search").addEventListener("click", async () => await app.start());
  document.querySelector("#disconnect").addEventListener("click", async () => await app.stop());
  window.addEventListener('beforeunload', async () => await app.stop())
});
