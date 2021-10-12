require('dotenv').config();
const errDesc = require('./semrushErrorList');
const howto = require('./semrushHowto');
const axios = require('axios').default;
const api_key = process.env.API_KEY;
export default function handler (event, context){
    
    const watchErr = [];
    const prod = true; 
    const HTML_RESPONSE = true;
    const { URL } = process.env
    const domainCheck = [131, 132, 135]       
    let payload={tasks:[]};

    if(!event.queryStringParameters.id){
        return {
            statusCode: 404,
            body: 'empty body'
        }
    }   
    const project_id = event.queryStringParameters.id;
    payload['account'] =  event.queryStringParameters.account || null;
    let projectPromise;
    const projectInfo = `https://api.semrush.com/management/v1/projects/${project_id}?key=${api_key}`;
    try {
        projectPromise = await axios.get(projectInfo);
        payload['project_name'] = projectPromise.data.project_name;
    }
    catch (error){
        return {
            statusCode: 404,
            body: 'Invalid ID'
        }
    }
    const snapShotsEndpoint = `https://api.semrush.com/reports/v1/projects/${project_id}/siteaudit/snapshots?key=${api_key}`;    
    let snapshotPromise = await axios.get(snapShotsEndpoint);
    if(!snapshotPromise.data.snapshots){
        return {
            statusCode:400,
            body: "Error"
        }
    }    
    const currentSnapshot = snapshotPromise.data.snapshots.pop().snapshot_id;
    const snapshotDetailEndpoint = `https://api.semrush.com/reports/v1/projects/${project_id}/siteaudit/snapshot?snapshot_id=${currentSnapshot}&key=${api_key}&limit=200`;
    let snapshotDetail = await axios.get(snapshotDetailEndpoint);
    snapshotDetail = snapshotDetail.data;
    let errorList = [];
    //console.log(snapshotDetail)
    snapshotDetail.errors.map(async (err) =>{     
        if( prod && err.count > 0 &&  typeof(errDesc[err.id]) != 'undefined' && errDesc[err.id].include){
            errorList.push(err);
        }else if(err.count > 0 && watchErr.includes(err.id) ){
            errorList.push(err);
        }
    });
    snapshotDetail.warnings.map(async (err) =>{     
        if( prod && err.count > 0 && typeof(errDesc[err.id]) != 'undefined' && errDesc[err.id].include){
            errorList.push(err);
        }
        else if(err.count > 0 && watchErr.includes(err.id) ){
            errorList.push(err);
        }
    });
    snapshotDetail.notices.map(async (err) =>{    
        if(prod && err.count > 0 && typeof(errDesc[err.id]) != 'undefined' && errDesc[err.id].include){
            errorList.push(err);
        }
        else if(err.count > 0 && watchErr.includes(err.id) ){
            errorList.push(err);
        }
    });
    const errorDetailEndpoint = `https://api.semrush.com/reports/v1/projects/${project_id}/siteaudit/snapshot/${currentSnapshot}/issue/`
    //console.log(errorList, errorDetailEndpoint);
    let detailsHtml = ``;
    let errorsDetail = await getData(errorList, errorDetailEndpoint);
    errorsDetail.map(error=>{        
        //console.log("--Error Details---", error.data)
        //console.log(JSON.stringify(error.data, null, 4))
        if(errDesc[error.data.issue_id].sendTo){

        
            let obj = {
                notify: errDesc[error.data.issue_id].sendTo,
                desc: errDesc[error.data.issue_id].title,
                urls:{},
                errorID:error.data.issue_id,
                howtofix: howto[`siteaudit.issue.${error.data.issue_id}.descFix`]
            };
            //console.log(error.data)
            /* 
            	        Exclude	           Include
                Branch	/blog/posts/p	   /blog/post
                Branch	/blog/category	
                Branch	/blog/tag	
                kentico	/blog/posts/p	   /blog/posts
                Kentico	/blog/category	
                Kentico	/blog/tags	
		    */
            error.data.data.map(e=>{ 
                //if(error.data.issue_id == 6)  console.log(error.data.issue_id, e.source_url) 
                if(!e.source_url.includes("/blog/category") && !e.source_url.includes("/blog/tag")  &&  !e.source_url.includes("/search") && !e.source_url.includes("/blog/posts/p/")){
                    //console.log(typeof(obj.urls[`${e.title}`]))                    
                        if(domainCheck.includes(error.data.issue_id) && e.target_url && e.target_url.includes(projectPromise.data.url) ){
                            if(!obj.urls[`${e.title}`]){ obj.urls[`${e.title}`] = [];}
                            obj.urls[`${e.title}`].push( (e.target_url)? e.source_url+" --> "+e.target_url : e.source_url );
                        }else if(!domainCheck.includes(error.data.issue_id)){
                            if(!obj.urls[`${e.title}`]){ obj.urls[`${e.title}`] = [];}
                            obj.urls[`${e.title}`].push( (e.target_url)? e.source_url+" --> "+e.target_url : e.source_url );
                        }              
                }            
            })
            
        //console.log("--Error Details---");
            detailsHtml += `
                <div>
                    ISSUE ID:${error.data.issue_id} - ${errDesc[error.data.issue_id].title} - send to: ${errDesc[error.data.issue_id].sendTo} <br/> 
                    <br/> 
                </div>
            `;
            payload.tasks.push(obj);
        }
    });

    let htmlView = "";
    //console.log("PAYLOAD", payload);
    if(HTML_RESPONSE){
        payload.tasks.map((t)=>{
            if(Object.keys(t.urls).length !== 0){
                htmlView += `<div> <h2>${t.desc} - Task for: ${t.notify}</h2>  
                    <h3>How to Fix it: <br><br><span style="font-size:0.8em; font-weight: 400;">${t.howtofix}</span> </h3>
                    <h3>Affected Pages: </h3>
                    <div style='margin-left:20px'>`;
                
                for (const [title, urls] of Object.entries(t.urls)) {
                    htmlView +=`<h3>${title}</h3> `;                
                    urls.map(url=>{htmlView += `<div>${url}</div>`})            
                }
                htmlView += `</div></div>`
            }
            
        }); 
    }
    
    try{
        console.log("Semrush payload ", payload.tasks.length);

        // if(payload.tasks.length)
        //     SFpromise = await axios.post(`${URL}/.netlify/functions/salesforce`, payload)
       // console.log(SFpromise);
    }catch(e){
        console.log("SF ERROR", e.data);
    }
    return ({
        statusCode:200, 
        body:
        `<html>
            <body>  
                <h1>${payload.project_name}</h1>  
                <div>Snapshot ID - ${currentSnapshot}</div>
                <div>Errors : <br /> ${detailsHtml} </div>
                <div>${htmlView}<div>
            </body>
        </html>`
    }
        
    )
    
}


const getData = async (list, baseURl) => {
    return Promise.all(list.map(item => axios.get(`${baseURl}${item.id}?key=${api_key}&limit=200`)))
}