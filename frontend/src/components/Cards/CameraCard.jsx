export default function CameraCard(){

return(

<div className="bg-slate-900 rounded-3xl border border-slate-800 p-6">

<h2 className="text-xl font-bold">

Camera Status

</h2>

<div className="mt-6 space-y-4">

<div className="flex justify-between">

<span>

Online

</span>

<span className="text-green-400">

245

</span>

</div>

<div className="flex justify-between">

<span>

Offline

</span>

<span className="text-red-400">

12

</span>

</div>

<div className="flex justify-between">

<span>

Maintenance

</span>

<span className="text-yellow-400">

6

</span>

</div>

</div>

</div>

)

}