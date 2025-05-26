class CommandExecutor {
    constructor(pico) {
        this.pico = pico
        this.commands =  {
            'Ctrl-A': '\r\x01',
            'Ctrl-B': '\r\x02',
            'Ctrl-C': '\r\x03',
            'Ctrl-D': '\x04',
            'Ctrl-E': '\x05'
        }
        this.output = []
        this.commandStarted = false
        this.commandStartEndMark = '>>> '
        this.outputStarted = false
        this.outputStartMark = '>OK'
        this.outputEndMark = `${this.commands["Ctrl-D"]}${this.commands["Ctrl-D"]}>`
    }

    subscribe(callback) {
        if (typeof callback == 'function'){
            callback.__id = Math.floor((Math.random() * 10000))
            this.pico.subscribe(callback.__id, this.lineParser.bind(this, callback))
        }
    }

    unsubscribe(callback) {
        this.pico.unsubscribe(callback.__id)
    }

    lineParser(callback, line) {
        if (line == this.commandStartEndMark) {
            if (this.commandStarted && typeof callback == 'function') {
                this.unsubscribe(callback)
                callback('OK')
                this.commandStarted = false
            } else {
                this.commandStarted = true
            }
        }

        if (line.includes(this.outputEndMark)) { // output completed
            this.unsubscribe(callback)
            if (typeof callback == 'function') {
                if (this.outputStarted && this.output.length) callback(this.output)
                else callback(this.outputStarted || line.includes(this.outputStartMark))
            }
            this.outputStarted = false
            this.output = []
            this.commandStarted = false
        }
        if (this.outputStarted) {
            this.output.push(line)
        }
        if (line.includes(this.outputStartMark)) {
            this.output = []
            this.outputStarted = true
            if (line.length > this.outputStartMark.length) this.output.push(line.substr(this.outputStartMark.length)) // edge case '>OK<output>'
        }
    }

    execInterrupt(callback = null) {
        this.subscribe(callback)
        this.pico.writeIntoPico(this.commands["Ctrl-C"])
    }

    execReboot(callback = null) {
        this.subscribe(callback)
        this.pico.writeIntoPico(this.commands["Ctrl-C"])
        this.pico.writeIntoPico(this.commands["Ctrl-D"])
    }

    execListDir(dir='/', callback) {
        this.subscribe(callback)
        this.pico.writeIntoPico(
            `
            ${this.commands["Ctrl-A"]}
            ${__cmdListDir(dir)}
            ${this.commands["Ctrl-D"]}
            ${this.commands["Ctrl-B"]}
            `
        )
    }

    execWriteFile(target, data, callback) {
        this.subscribe(callback)
        this.pico.writeIntoPico(
            `
            ${this.commands["Ctrl-A"]}
            ${__cmdWriteFile(target, data)}
            ${this.commands["Ctrl-D"]}
            ${this.commands["Ctrl-B"]}
            `
        )
    }

    execReadFile(target, callback) {
        this.subscribe(callback)
        this.pico.writeIntoPico(
            `
            ${this.commands["Ctrl-A"]}
            ${__cmdReadFile(target)}
            ${this.commands["Ctrl-D"]}
            ${this.commands["Ctrl-B"]}
            `
        )
    }
}

const __cmdListDir = (dir) => {  
return `
import os
for (file, type, inode, size) in os.ilistdir('${dir}'):
    print(f"{file}|{type==0x4000}|{size}")
`
}

const __cmdWriteFile = (target, data) => {  
return `
f=open('${target}','w')
f.write("""${data}""")
f.close()
`
}

const __cmdReadFile = (target) => {  
return `
with open('${target}', 'r') as file:
    for line in file:
        print(line.rstrip())
`
}