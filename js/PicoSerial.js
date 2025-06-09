const VENDOR_ID = 0x2E8A

class PicoSerial {
  constructor(onConnect, onDisconnect, logger) {
    this.picoPort = null
    this.reading = false
    this.textDecoder = new TextDecoder()
    this.textEncoder = new TextEncoder()
    this.readLineBuffer = ''
    this.readLineSubscribers = []
    this.commandExecutor = new CommandExecutor(this)
    this.connectCallback = onConnect
    this.disconnectCallback = onDisconnect
    this.logger = logger
  }

  async connect() {
    if (!navigator.serial) {
      alert("Your browser doesn't support connecting to the Pico (Web Serial API)")
    } else {
      if (!this.picoPort) this.picoPort = await navigator.serial.requestPort({ filters: [{ usbVendorId: VENDOR_ID }] })
      if (this.picoPort) await this.openPico()
    }
  }

  async openPico() {
    if (this.picoPort) await this.picoPort.open({ baudRate: 115200 })
    this.onConnect()
    this.reader = this.picoPort.readable.getReader()
    this.writer = this.picoPort.writable.getWriter()
    setTimeout(this.readFromPico.bind(this), 10)
    this.picoPort.addEventListener('disconnect', this.onDisconnect.bind(this))
  }

  onConnect() {
    this.connectCallback()
  }

  onDisconnect() {
    this.picoPort = null
    this.disconnectCallback()
  }

  async readFromPico() {
    this.reading = true
    try {
      while (this.reading) {
        const { value } = await this.reader.read()
        const stringValue = this.textDecoder.decode(value)
        this.commandExecutor.streamer(stringValue)
        this.logger(stringValue)
      }
    } catch (e) {
      console.log('Read from Pico error', e)
    }
  }

  async writeIntoPico(str) {
    const buffer = this.textEncoder.encode(str)
    console.log('writing to pico')
    await this.writer.write(buffer)
  }

  async disconnect() {
    this.reading = false
    await this.reader.cancel()
    await this.reader.releaseLock()
    await this.writer.close()
    await this.writer.releaseLock()
    await this.picoPort.close()
    this.onDisconnect()
  }

  listFiles(dir, callback) {
    this.commandExecutor.execListDir(dir, callback)
  }

  readFile(file, callback) {
    this.commandExecutor.execReadFile(file, callback)
  }

  saveFile(file, content, callback) {
    this.commandExecutor.execWriteFile(file, content, callback)
  }

  stopDevice(callback = null) {
    this.commandExecutor.execInterrupt(callback)
  }

  rebootDevice() {
    this.commandExecutor.execReboot()
  }
}