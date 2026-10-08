import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'

function App() {
let isTeacher: boolean = false;
const name: string = "Ibrahim";
let age: number = 17;

let colors:string[] = ["pink", "orange", "purple"];

let teacher= new Person();

teacher.name = name;
  teacher.age = age;
  teacher.isTeacher = isTeacher;

let people: Person[] = [
    { name: "Rob", age: 39, isTeacher: true },
    { name: "Jane", age: 28, isTeacher: false },
    { name: "Sam", age: 42, isTeacher: false },
  ];
return Person;
}
class Person {
  name!: string;
  age!: number;
  isTeacher!: boolean;

}

export default App;