async function main(){
    console.log("hello")
    try {
        const p = new Promise(async (res, rej) => {
            const x = await fetch('https://jsonplaceholder.typicode.com/todos/1')
                .then(response => response.json())
            setTimeout(()=> rej(x),3000)
                // .then(json => console.log('first call:', json))
        }).catch(err=> console.error(err))
        p.then(d=> console.log('error', d))
    } catch(e) {
        console.error('error', e)
    }
}
main()