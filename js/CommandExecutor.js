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
        this.output = ''
        this.commandStarted = false
        this.commandStartEndMark = '>>> '
        this.outputStarted = false
        this.outputStartMark = '>OK'
        this.outputEndMark = `${this.commands["Ctrl-D"]}>`
        this.outputCallback = null
        this.parseTimer = null
    }

    streamer(value) {
        if (!value) return
        clearTimeout(this.parseTimer)
        this.streamBuffer += value
        if(this.streamBuffer.includes( '\r\n')) {
            const lines = this.streamBuffer.split( '\r\n')
            this.streamBuffer = lines.pop() // store left over chars
            lines.forEach(line => {
                this.lineParser(line)
            })
        }
        this.parseTimer = setTimeout(this.lineParser.bind(this, this.streamBuffer), 200)
    }

    lineParser(line) {
        if (line.includes(this.commandStartEndMark)) {
            if (this.commandStarted) {
                this.commandStarted = !this.commandStarted
                this.invokeOutputCallback('OK')
            }
        }
        if (line.includes(this.outputEndMark)) { // result completed
            if (this.outputStarted && this.output.length) this.invokeOutputCallback(this.output)
            else this.invokeOutputCallback(this.outputStarted || line.includes(this.outputStartMark))
            this.output = ''
            this.outputStarted = false
        }
        if (this.outputStarted) {
            this.output += this.output ? '\n' + line : line
        }
        if (line.includes(this.outputStartMark) && !line.includes(this.outputEndMark)) { // result started
            this.output = ''
            this.outputStarted = true
            if (line.length > this.outputStartMark.length) this.output += line.substr(this.outputStartMark.length) // edge case '>OK<output>'
        }
    }

    invokeOutputCallback(result) {
        if (typeof this.outputCallback == 'function') {
            this.outputCallback(result)
        }
        this.outputCallback = null
    }

    execInterrupt(callback = null) {
        this.outputCallback = callback
        this.pico.writeIntoPico(this.commands["Ctrl-C"])
    }

    execReboot(callback = null) {
        this.outputCallback = callback
        this.pico.writeIntoPico(this.commands["Ctrl-C"])
        this.pico.writeIntoPico(this.commands["Ctrl-D"])
    }

    execListDir(dir='/', callback) {
        this.outputCallback = callback
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
        this.outputCallback = callback
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
        this.outputCallback = callback
        this.pico.writeIntoPico(
            `
            ${this.commands["Ctrl-A"]}
            ${__cmdReadFile(target)}
            ${this.commands["Ctrl-D"]}
            ${this.commands["Ctrl-B"]}
            `
        )
    }

    execCreateFile(target, callback) {
        this.outputCallback = callback
        this.pico.writeIntoPico(
            `
            ${this.commands["Ctrl-A"]}
            ${__cmdCreateFile(target)}
            ${this.commands["Ctrl-D"]}
            ${this.commands["Ctrl-B"]}
            `
        )
    }

    execCreateFolder(target, callback) {
        this.outputCallback = callback
        this.pico.writeIntoPico(
            `
            ${this.commands["Ctrl-A"]}
            ${__cmdCreateFolder(target)}
            ${this.commands["Ctrl-D"]}
            ${this.commands["Ctrl-B"]}
            `
        )
    }

    execDeleteFile(target, callback) {
        this.outputCallback = callback
        this.pico.writeIntoPico(
            `
            ${this.commands["Ctrl-A"]}
            ${__cmdDeleteFile(target)}
            ${this.commands["Ctrl-D"]}
            ${this.commands["Ctrl-B"]}
            `
        )
    }

    execRenameFile(src, target, callback) {
        this.outputCallback = callback
        this.pico.writeIntoPico(
            `
            ${this.commands["Ctrl-A"]}
            ${__cmdRenameFile(src, target)}
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

const __cmdCreateFile = (target) => {  
return `
open('${target}', 'w')
`
}

const __cmdCreateFolder = (target) => {  
return `
import os
os.mkdir('${target}')
`
}

const __cmdDeleteFile = (target) => {  
return `
import os
os.remove('${target}')
`
}

const __cmdRenameFile = (src, target) => {  
return `
import os
os.rename('${src}', '${target}')
`
}