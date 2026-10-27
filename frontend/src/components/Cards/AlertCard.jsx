import { FaBell } from "react-icons/fa";

const alerts = [

{
id:1,
title:"Large pothole detected",
location:"GST Road",
severity:"High"
},

{
id:2,
title:"Road Crack",
location:"OMR",
severity:"Medium"
},

{
id:3,
title:"Accident Detected",
location:"Vandalur",
severity:"Critical"
},

{
id:4,
title:"Repair Completed",
location:"Tambaram",
severity:"Completed"
}

];

export default function AlertCard(){

return(

<div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 h-[550px]">

<div className="flex justify-between">

<h2 className="text-2xl font-bold">

Live Alerts

</h2>

<FaBell className="text-yellow-400 text-2xl"/>

</div>

<div className="space-y-4 mt-8">

{

alerts.map((alert)=>(

<div

key={alert.id}

className="bg-slate-800 rounded-2xl p-4 hover:bg-slate-700 transition"

>

<h3 className="font-semibold">

{alert.title}

</h3>

<p className="text-gray-400 mt-2">

📍 {alert.location}

</p>

<span className="inline-block mt-3 px-3 py-1 rounded-full bg-red-500/20 text-red-400">

{alert.severity}

</span>

</div>

))

}

</div>

</div>

)

}