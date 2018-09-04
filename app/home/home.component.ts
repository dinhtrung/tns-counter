import { Component, OnInit } from "@angular/core";
import { alert, prompt } from "tns-core-modules/ui/dialogs";

@Component({
    selector: "Home",
    moduleId: module.id,
    templateUrl: "./home.component.html",
    styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
    onButtonTap(): void {
        console.log("Button was pressed");
    }

    gaugeValue: number = 2;


    items: any[] = [];

    constructor() {
    }

    ngOnInit(): void {
        for (let i = 0; i < 5; i++) {
            this.items.push({
                title: 'Habit #' + i,
                progress: this.random(0, 100),
                cnt: this.getWeeklyData(),
            });
        }
        console.log('Got items' + JSON.stringify(this.items) );
    }

    addNew(): void {
        prompt({
            title: "Add a new Habit",
            message: "Enter the name of the new habit",
            inputType: "email",
            defaultText: "",
            okButtonText: "Ok",
            cancelButtonText: "Cancel"
        }).then((data) => {
            if (data.result) {
                this.items.push({
                    title: data.text.trim(),
                    progress: 0,
                    cnt: [0, 0, 0, 0, 0, 0, 0]
                });
            }
        });
    }

    random(min = 50, max = 150) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    onItemTap(i) {
        console.log('On Item tap', i);
        i.cnt += 1;
        alert('Got new cnt: ' + i.cnt);
    }

    getWeeklyData() {
        let result = [];
        for (let i = 0; i < 7; i++) {
            result.push(this.random(0, 100));
        }
        return result;
    }

    showItem(i) {
        alert(i.title);
    }

    removeItem(i) {
        this.items = this.items.filter((v) => v !== i);
    }

    incItem(i, k) {
        i.cnt[k] += 1;
    }

    decItem(i, k) {
        i.cnt[k] -= 1;
    }

    onSwipe(args, i, k) {
        console.log("Swipe Direction: " + args.direction);
    }
}
