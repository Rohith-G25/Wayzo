const incidents=[

"Road Damage",

"Vehicle Accident",

"Water Logging",

"Traffic Congestion",

"Broken Signal"

]

export default function IncidentCard(){

return(

<div className="bg-slate-900 rounded-3xl border border-slate-800 p-6">

<h2 className="text-xl font-bold">

Incident Types

</h2>

<div className="mt-6 space-y-3">

{

incidents.map((item,index)=>(

<div

key={index}

className="bg-slate-800 p-3 rounded-xl"

>

{item}

</div>

))

}

</div>

</div>

)

}