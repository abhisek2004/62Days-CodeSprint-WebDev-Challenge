const slider=document.querySelector(".slider");
const leftBtn=document.querySelector(".left");
const rightBtn=document.querySelector(".right");

const scroll=800;

leftBtn.addEventListener("click",()=>{
    slider.scrollBy({
        left:-scroll,
        behavior:"smooth",
    })
})

rightBtn.addEventListener("click",()=>{
    slider.scrollBy({
        left:scroll,
        behavior:"smooth",
    })
})
function updatebtn(){
  if (slider.scrollLeft <= 0) {
    leftBtn.classList.add("opacity-0", "pointer-events-none");
    leftBtn.classList.remove("opacity-100");
  } else {
    leftBtn.classList.remove("opacity-0", "pointer-events-none");
    leftBtn.classList.add("opacity-100");
  }

  // Hide right button at the end
  if (slider.scrollLeft + slider.clientWidth >= slider.scrollWidth - 1) {
    rightBtn.classList.add("opacity-0", "pointer-events-none");
    rightBtn.classList.remove("opacity-100");  } 
    else {
    rightBtn.classList.remove("opacity-0", "pointer-events-none");
    rightBtn.classList.add("opacity-100");
  }
}
slider.addEventListener("scroll", updatebtn);
updatebtn();



plus=document.querySelector(".plus");
answ=document.querySelector(".hid");
plus.addEventListener("click",()=>{
    plus.style.backgroundColor="#3f3f46"
    answ.style.visibility="visible";
})





plusButtons=document.querySelectorAll(".plus");
plusButtons.forEach((button)=>{
    button.addEventListener("click",()=>{
    const answer=button.nextElementSibling;
    const icon=button.querySelector(".symb");

    document.querySelectorAll(".hid").forEach((item)=>{
        if(item !== answer){
            item.classList.add("hidden");
        }
    });

    document.querySelectorAll(".plus .symb").forEach((item)=>{
        if(item!==icon){
            item.classList.remove("rotate-45");
        }
    });
    answer.classList.toggle("hidden");
    icon.classList.toggle("rotate-45");
});
});