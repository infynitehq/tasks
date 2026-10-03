import { TodoList } from "@/components/todo-list"

export default function Home() {
  return (
    <main className="h-full bg-background flex items-start justify-center px-4 overflow-x-hidden overflow-y-hidden">
      <TodoList />
    </main>
  )
}
