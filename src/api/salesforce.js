var axios = require("axios").default;
//0053F000007Km5mQAC - jbarrios-test@lobstermarketing.com.partial
//0053F0000078zrBQAQ - jorge@lobstermarketing.com.partial
///005f4000003pHIJ - austin@pcocentral.com.partial
const salesforce = async function salesforce (tsks) {
    let randomNumb =  Math.floor(100000 + Math.random() * 900000);
    let tasks = null;
    let project_name = null;
    let account = null;
    const today = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toJSON().slice(0,10)
    let auth = await axios.post(`${process.env.ACCESS_TOKEN_URL}?grant_type=password&client_id=${process.env.CLIENT_ID}&client_secret=${process.env.CLIENT_SECRET_ID}&username=${process.env.USERNAME}&password=${process.env.PASSWORD}${process.env.SECURITY_TOKEN}`)
    console.log(tsks)
    
    project_name = tsks.project_name;
    account = tsks.account;
    let payloadTasks = [];
    
    tsks.map(task=>{
        if(Object.keys(task.urls).length !== 0){            
            let description = `${task.desc.toUpperCase()} \n\n`;
            description += `How to fix it: \n\n`
            description += `${task.howtofix.replace(/(<([^>]+)>)/gi, "")} \n\n`
            description += `Affected Pages: \n\n`
            for (const [title, urls] of Object.entries(task.urls)) {
                description += `- ${title} \n`
                urls.map(url=>{ description += `-- ${url} \n`});
                description += `\n`;
            }
        
            
            
                
            payloadTasks.push(  
                {
                    Subject: "#"+ randomNumb +" Semrush - " + project_name +" - "+ task.desc ,
                    Priority: 'Medium',
                    Description: description,
                    ActivityDate: today,
                    OwnerId: task.notify,
                    WhatId: account,
                    Team__c: "Support",
                    Task_Type__c: "Site Audit",
                    Task_Category__c: "Quality Check",
                    Recurring_Task__c: false,
                }
            );

        }
        
        
    })
    console.log("payload # ",payloadTasks.length)

    let r = await createTasks(payloadTasks, auth);
    payloadTasks = [];
    console.log("Promise All response");
    //context.status(200).send();
}

async function  createTasks (tasks, auth){
    let responsePromiseAll = null;
    let promises = [];
    tasks.map(payload=>{
        promises.push(
        axios({ 
            method: 'POST',
            url: `${process.env.SF_URL}/services/data/v49.0/sobjects/Task/`,
                headers: {
                'content-type': 'application/json',
                authorization: 'Bearer ' + auth.data.access_token
                },
                data: payload
            }) 
        )
    });
    console.log("total promises ", promises.length)
    responsePromiseAll = await Promise.all(promises);

    return responsePromiseAll;
    
       
}
module.exports = salesforce;