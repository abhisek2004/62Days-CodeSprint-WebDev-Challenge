const modeBtn = document.querySelector(".mode");

modeBtn.addEventListener("click", () => {
  document.documentElement.classList.toggle("dark");
  if(document.documentElement.classList.contains("dark")){
    modeBtn.textContent="☀️"
  }
  else{
    modeBtn.textContent="🌛"
  }
});

//taking input
const buttons=document.querySelectorAll(".val");
let expression="";
buttons.forEach((button)=>{
  button.addEventListener("click",()=>{
    val=button.textContent;
    expression+=val;
    document.querySelector(".in1").innerText=expression;
    const result = Function(`return (${expression})`)();
    document.querySelector(".out").innerText=result;
  })
})
clBtn=document.querySelector(".cl");
clBtn.addEventListener("click",()=>{
  expression="";
  result="";
      document.querySelector(".in1").innerText=expression;
    document.querySelector(".out").innerText=result;
});

er1=document.querySelector(".er1");
er1.addEventListener("click",()=>{
  expression=expression.slice(0,-1);
        document.querySelector(".in1").innerText=expression;
if (expression.trim() === "") {
    document.querySelector(".out").innerText = "";
} else {
    try {
        const result = Function(`return (${expression})`)();
        document.querySelector(".out").innerText = result;
    } catch (err) {
        document.querySelector(".out").innerText = "";
    }
}
})

eq=document.querySelector(".eq");
eq.addEventListener("click",()=>{
  expression="";
        document.querySelector(".in1").innerText=expression;
})