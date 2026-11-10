import type { Metadata } from "next";
import { IdeaForm } from "@/components/ideas/idea-form";

export const metadata: Metadata = {
  title: "Your idea, I develop",
  description: "Gửi ý tưởng sản phẩm — mình sẽ build nó bằng AI, miễn phí, không đòi hỏi quyền sở hữu hay lợi ích."
};

export default function IdeasPage() {
  return (
    <main className="idea-page">
      <section className="idea-intro">
        <p className="idea-kicker">Campaign // Your idea, I develop</p>
        <h1>Bạn có ý tưởng. Mình sẽ build nó.</h1>

        <h2>Cách hoạt động</h2>
        <ol>
          <li>Bạn mô tả ý tưởng sản phẩm qua form bên cạnh.</li>
          <li>Mình đọc tất cả và chọn những ý tưởng phù hợp để thực hiện.</li>
          <li>Nếu được chọn, mình liên hệ để hiểu rõ hơn trước khi bắt tay vào làm.</li>
          <li>Mình phát triển sản phẩm và bàn giao cho bạn.</li>
        </ol>

        <h2>Không có điều kiện ràng buộc</h2>
        <p>
          Mình <strong>không đòi hỏi bất kỳ lợi ích hay quyền sở hữu nào</strong> từ sản phẩm. Ý tưởng là của bạn,
          sản phẩm cũng là của bạn.
        </p>

        <h2>Vì sao mình làm việc này?</h2>
        <p>
          Để mở rộng góc nhìn qua những bài toán thật mà mình sẽ không tự nghĩ ra, để khám phá xem AI thực sự có thể
          làm được những gì, và để có cơ hội nghiên cứu chuyên sâu hơn về AI qua từng sản phẩm.
        </p>
      </section>

      <IdeaForm />
    </main>
  );
}
