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
        const encoder = new TextEncoder();
        const bytes = encoder.encode(data);
        const base64Data = arrayBufferToBase64(bytes.buffer);
        
        this.writeBase64File(target, base64Data)
            .then(() => {
                if (typeof callback === 'function') callback('OK');
            })
            .catch((err) => {
                if (typeof callback === 'function') callback('OSError: ' + err);
            });
    }

    execCommandPromise(code) {
        return new Promise((resolve) => {
            this.outputCallback = resolve;
            this.pico.writeIntoPico(`${this.commands["Ctrl-A"]}${code}${this.commands["Ctrl-D"]}${this.commands["Ctrl-B"]}`);
        });
    }

    async writeBase64File(target, base64Data) {
        const chunkLength = 1024;
        const totalLen = base64Data.length;
        const escapedTarget = target.replace(/\\/g, '/').replace(/'/g, "\\'");
        
        if (totalLen === 0) {
            const code = `with open('${escapedTarget}', 'wb') as f: pass`;
            await this.execCommandPromise(code);
            return;
        }
        
        for (let i = 0; i < totalLen; i += chunkLength) {
            const chunk = base64Data.slice(i, i + chunkLength);
            const mode = (i === 0) ? 'wb' : 'ab';
            const code = `import ubinascii\nwith open('${escapedTarget}', '${mode}') as f: f.write(ubinascii.a2b_base64('${chunk}'))`;
            await this.execCommandPromise(code);
        }
    }

    execCreateFolderRecursive(target) {
        const escapedTarget = target.replace(/\\/g, '/').replace(/'/g, "\\'");
        const code = `import os
def makedirs(path):
    parts = path.strip('/').split('/')
    current = ''
    for part in parts:
        if not part: continue
        current += '/' + part
        try:
            os.mkdir(current)
        except OSError:
            pass
makedirs('${escapedTarget}')`;
        return this.execCommandPromise(code);
    }

    execReadFile(target, callback) {
        this.outputCallback = callback
        const code = __cmdReadFile(target)
        this.pico.writeIntoPico(`${this.commands["Ctrl-A"]}${code}${this.commands["Ctrl-D"]}${this.commands["Ctrl-B"]}`)
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

    execDeleteAllRecursive(target, callback) {
        this.outputCallback = callback
        const escapedTarget = target.replace(/\\/g, '/').replace(/'/g, "\\'");
        const code = `import os
def delete_all_recursive(path):
    def rm_rf(p):
        try:
            for item in os.listdir(p):
                full_path = (p.rstrip('/') + '/' + item) if p else item
                try:
                    mode = os.stat(full_path)[0]
                    is_dir = (mode & 0o040000) != 0
                except Exception:
                    is_dir = False
                if is_dir:
                    rm_rf(full_path)
                    try:
                        os.rmdir(full_path)
                    except Exception:
                        pass
                else:
                    try:
                        os.remove(full_path)
                    except Exception:
                        pass
        except Exception:
            pass
    rm_rf(path)
delete_all_recursive('${escapedTarget}')`;

        this.pico.writeIntoPico(`${this.commands["Ctrl-A"]}${code}${this.commands["Ctrl-D"]}${this.commands["Ctrl-B"]}`)
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
    const escapedTarget = target.replace(/\\/g, '/').replace(/'/g, "\\'");
    return `import ubinascii
with open('${escapedTarget}', 'rb') as f:
    print(ubinascii.b2a_base64(f.read()).decode('utf-8').strip())`
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